import {EventType} from "../../domain/events/CanonicalEvent";
import {PaymentFactCanonicalStatus} from "../../domain/payment_fact/PaymentFact";
import {
    PaymentFlow,
    PaymentIntentState
} from "../../domain/payment_intent/PaymentIntent";

export interface PaymentStateTransition {
    nextState: PaymentIntentState;
    eventType: EventType;
}

export interface PaymentStateMachine {
    evaluateTransition(
        currentState: PaymentIntentState,
        paymentFlow: PaymentFlow,
        canonicalStatus: PaymentFactCanonicalStatus
    ): PaymentStateTransition | null;
}
