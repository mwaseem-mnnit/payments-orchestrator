/* 
 *   created by mohdwaseem
 *   created on 18/01/26 8:20pm
 *   To change this template use File | Settings | File and Code Templates.
*/

import {PaymentFact} from "../../domain/payment_fact/PaymentFact";

export interface PaymentFactsRepository {
    findByFactId(
        factId: string
    ): Promise<PaymentFact | null>;

    create(
        fact: PaymentFact
    ): Promise<{ created: boolean }>;

    findByTransactionId(
        transactionId: string
    ): Promise<ReadonlyArray<PaymentFact>>;

    updateProcessingOutcome(
        factId: string,
        processingOutcome: "NEW" | "PROCESSED" | "IGNORED" | "ORPHANED"
    ): Promise<boolean>;
}
