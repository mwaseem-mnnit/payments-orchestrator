import {PaymentFactCanonicalStatus} from "../../domain/payment_fact/PaymentFact";
import {
    PaymentFlow,
    PaymentIntentState
} from "../../domain/payment_intent/PaymentIntent";
import {
    PaymentStateMachine,
    PaymentStateTransition
} from "../port/PaymentStateMachine";

type TransitionTable = ReadonlyMap<
    PaymentIntentState,
    ReadonlyMap<PaymentFactCanonicalStatus, PaymentStateTransition>
>;

const PAYIN_TRANSITIONS: TransitionTable = new Map([
    [
        "PROCESSING",
        new Map<PaymentFactCanonicalStatus, PaymentStateTransition>([
            ["SUCCESS", {nextState: "SUCCEEDED", eventType: "gateway_success"}],
            ["FAILED", {nextState: "FAILED", eventType: "gateway_failure"}]
        ])
    ],
    [
        "AUTHORIZED",
        new Map<PaymentFactCanonicalStatus, PaymentStateTransition>([
            ["SUCCESS", {nextState: "SUCCEEDED", eventType: "gateway_success"}]
        ])
    ],
    [
        "FAILED",
        new Map<PaymentFactCanonicalStatus, PaymentStateTransition>([
            ["SUCCESS", {nextState: "SUCCEEDED", eventType: "gateway_success"}]
        ])
    ]
]);

const PAYOUT_TRANSITIONS: TransitionTable = new Map([
    [
        "PROCESSING",
        new Map<PaymentFactCanonicalStatus, PaymentStateTransition>([
            ["SUCCESS", {nextState: "SUCCEEDED", eventType: "gateway_success"}],
            ["FAILED", {nextState: "FAILED", eventType: "gateway_failure"}]
        ])
    ],
    [
        "SUCCEEDED",
        new Map<PaymentFactCanonicalStatus, PaymentStateTransition>([
            ["REVERSED", {nextState: "REVERSED", eventType: "gateway_reversal"}]
        ])
    ]
]);

/**
* Transition tables are intentionally code-defined and authoritative.
 * They must stay in sync with payment_state_machine.md
* */
export class DefaultPaymentStateMachine implements PaymentStateMachine {
    evaluateTransition(
        currentState: PaymentIntentState,
        paymentFlow: PaymentFlow,
        canonicalStatus: PaymentFactCanonicalStatus
    ): PaymentStateTransition | null {
        const table =
            paymentFlow === "PAYIN"
                ? PAYIN_TRANSITIONS
                : paymentFlow === "PAYOUT"
                  ? PAYOUT_TRANSITIONS
                  : undefined;

        if (!table) {
            return null;
        }

        return table.get(currentState)?.get(canonicalStatus) ?? null;
    }
}
