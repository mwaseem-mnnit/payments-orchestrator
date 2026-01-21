import {CanonicalEvent, EventSource, EventType} from "../../domain/events/CanonicalEvent";
import {
    PaymentFact,
    PaymentFactSource
} from "../../domain/payment_fact/PaymentFact";
import {PaymentIntent} from "../../domain/payment_intent/PaymentIntent";
import {Clock} from "../port/Clock";
import {EventPublisher} from "../port/EventPublisher";
import {Logger} from "../port/Logger";
import {PaymentFactsRepository} from "../port/PaymentFactsRepository";
import {PaymentIntentRepository} from "../port/PaymentIntentRepository";
import {
    PaymentStateMachine,
    PaymentStateTransition
} from "../port/PaymentStateMachine";

export class ProcessPaymentFactUpdateService {
    constructor(
        private readonly paymentFactsRepository: PaymentFactsRepository,
        private readonly paymentIntentRepository: PaymentIntentRepository,
        private readonly paymentStateMachine: PaymentStateMachine,
        private readonly canonicalEventPublisher: EventPublisher,
        private readonly clock: Clock,
        private readonly logger: Logger
    ) {}

    async execute(paymentFactId: string): Promise<void> {
        this.logger.info("Starting payment fact processing", {
            paymentFactId
        });

        const paymentFact = await this.paymentFactsRepository.findByFactId(
            paymentFactId
        );

        if (!paymentFact) {
            throw new Error(`PaymentFact not found for factId: ${paymentFactId}`);
        }

        if (paymentFact.processingOutcome !== "NEW") {
            return;
        }

        const paymentIntent = await this.paymentIntentRepository.findByTransactionId(
            paymentFact.transactionId
        );

        if (!paymentIntent) {
            await this.handleOrphanedPaymentFact(paymentFact);
            return;
        }

        const transition = this.paymentStateMachine.evaluateTransition(
            paymentIntent.state,
            paymentFact.paymentFlow,
            paymentFact.canonicalStatus
        );

        if (!transition) {
            await this.handleIgnoredPaymentFact(paymentFact, paymentIntent);
            return;
        }

        await this.handleProcessedPaymentFact(paymentIntent, transition, paymentFact);
    }

    private async handleProcessedPaymentFact(paymentIntent: PaymentIntent, transition: PaymentStateTransition, paymentFact: PaymentFact) {
        const updatedPaymentIntent = this.applyTransition(paymentIntent, transition);
        await this.paymentIntentRepository.update(updatedPaymentIntent);

        this.logger.info("PaymentIntent state transition applied", {
            paymentIntentId: updatedPaymentIntent.paymentIntentId,
            transactionId: updatedPaymentIntent.transactionId,
            fromState: paymentIntent.state,
            toState: updatedPaymentIntent.state
        });

        await this.emitTransitionEvent(
            paymentFact,
            updatedPaymentIntent,
            transition
        );

        await this.paymentFactsRepository.updateProcessingOutcome(
            paymentFact.factId,
            "PROCESSED"
        );

        this.logger.info("PaymentFact marked PROCESSED", {
            paymentFactId: paymentFact.factId,
            transactionId: paymentFact.transactionId
        });
    }

    private async handleIgnoredPaymentFact(paymentFact: PaymentFact, paymentIntent: PaymentIntent) {
        await this.paymentFactsRepository.updateProcessingOutcome(
            paymentFact.factId,
            "IGNORED"
        );

        this.logger.warn("Invalid transition attempted", {
            paymentFactId: paymentFact.factId,
            transactionId: paymentFact.transactionId,
            currentState: paymentIntent.state,
            canonicalStatus: paymentFact.canonicalStatus
        });

        await this.emitInvalidTransitionAttemptedEvent(
            paymentFact,
            paymentIntent
        );

        this.logger.info("PaymentFact marked IGNORED", {
            paymentFactId: paymentFact.factId,
            transactionId: paymentFact.transactionId
        });
    }

    private async handleOrphanedPaymentFact(paymentFact: PaymentFact) {
        await this.paymentFactsRepository.updateProcessingOutcome(
            paymentFact.factId,
            "ORPHANED"
        );

        this.logger.warn("PaymentFact orphaned", {
            paymentFactId: paymentFact.factId,
            transactionId: paymentFact.transactionId
        });

        await this.emitPaymentFactOrphanedEvent(paymentFact);

        this.logger.info("PaymentFact marked ORPHANED", {
            paymentFactId: paymentFact.factId,
            transactionId: paymentFact.transactionId
        });
    }

    private applyTransition(
        paymentIntent: PaymentIntent,
        transition: PaymentStateTransition
    ): PaymentIntent {
        return new PaymentIntent(
            paymentIntent.paymentIntentId,
            paymentIntent.paymentFlowType,
            paymentIntent.operationType,
            paymentIntent.amount,
            paymentIntent.currency,
            transition.nextState,
            paymentIntent.createdAt,
            this.clock.now(),
            paymentIntent.transactionId,
            paymentIntent.paymentMethodId,
            paymentIntent.gateway,
            paymentIntent.gatewayTransactionReference,
            paymentIntent.payerReference,
            paymentIntent.payeeReference,
            paymentIntent.failureCategory,
            paymentIntent.failureReason,
            paymentIntent.additionalAttributes
        );
    }

    private async emitTransitionEvent(
        paymentFact: PaymentFact,
        paymentIntent: PaymentIntent,
        transition: PaymentStateTransition
    ): Promise<void> {
        const event = this.buildCanonicalEvent(
            paymentFact,
            paymentIntent,
            transition.eventType,
            paymentFact.factId
        );

        await this.publishEvent(event, paymentFact);
    }

    private async emitPaymentFactOrphanedEvent(
        paymentFact: PaymentFact
    ): Promise<void> {
        const eventType = "payment_fact_orphaned" as EventType;
        const eventId = `${paymentFact.factId}:orphaned`;
        const event = this.buildCanonicalEvent(
            paymentFact,
            undefined,
            eventType,
            eventId
        );

        await this.publishEvent(event, paymentFact);
    }

    private async emitInvalidTransitionAttemptedEvent(
        paymentFact: PaymentFact,
        paymentIntent: PaymentIntent
    ): Promise<void> {
        const eventType = "invalid_transition_attempted" as EventType;
        const eventId = `${paymentFact.factId}:invalid`;
        const event = this.buildCanonicalEvent(
            paymentFact,
            paymentIntent,
            eventType,
            eventId
        );

        await this.publishEvent(event, paymentFact);
    }

    private buildCanonicalEvent(
        paymentFact: PaymentFact,
        paymentIntent: PaymentIntent | undefined,
        eventType: EventType,
        eventId: string
    ): CanonicalEvent {
        const eventTimestamp =
            paymentFact.occurredAt ?? paymentFact.receivedAt;
        const receivedAt = this.clock.now();
        const eventSource = this.mapEventSource(paymentFact.source);

        return new CanonicalEvent(
            eventId,
            eventType,
            paymentIntent ? paymentIntent.paymentIntentId : paymentFact.transactionId,
            eventSource,
            eventTimestamp,
            receivedAt,
            paymentIntent?.paymentFlowType,
            paymentIntent?.operationType,
            paymentIntent?.gateway ?? paymentFact.gatewayId,
            paymentIntent?.gatewayTransactionReference ??
                paymentFact.gatewayTransactionReference,
            undefined,
            paymentIntent?.failureCategory,
            paymentIntent?.failureReason,
            undefined,
            undefined,
            paymentFact.transactionId
        );
    }

    private async publishEvent(
        event: CanonicalEvent,
        paymentFact: PaymentFact
    ): Promise<void> {
        try {
            await this.canonicalEventPublisher.publish(event);
        } catch (error) {
            this.logger.warn("Failed to publish payment fact event", {
                paymentFactId: paymentFact.factId,
                transactionId: paymentFact.transactionId
            });
        }
    }

    private mapEventSource(source: PaymentFactSource): EventSource {
        switch (source) {
            case "GATEWAY_WEBHOOK":
            case "GATEWAY_POLLER":
                return "GATEWAY";
            case "BACKOFFICE":
                return "OPERATOR";
            case "SYSTEM":
                return "SYSTEM";
        }
    }
}
