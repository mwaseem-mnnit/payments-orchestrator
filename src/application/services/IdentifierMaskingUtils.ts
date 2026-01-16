import { IdentifierType } from "../../domain/payment_method_type/PaymentMethodType";

/**
 * Utility class for masking identifier values.
 * 
 * This class provides static methods to mask identifier values
 * based on their type, ensuring privacy and security.
 */
export class IdentifierMaskingUtils {
    /**
     * Masks an identifier value based on its type.
     * 
     * @param identifierType The type of identifier
     * @param identifierValue The value to mask
     * @returns The masked value
     */
    static maskIdentifier(identifierType: IdentifierType, identifierValue: string): string {
        if (!identifierValue || identifierValue.length === 0) {
            return "";
        }

        switch (identifierType) {
            case "UPI_VPA":
                // Mask UPI VPA: show first char and last 4 chars after @
                // e.g., "user@upi" -> "u***@upi"
                const atIndex = identifierValue.indexOf("@");
                if (atIndex > 0) {
                    const firstChar = identifierValue[0];
                    const domain = identifierValue.substring(atIndex);
                    return `${firstChar}***${domain}`;
                }
                return this.genericMask(identifierValue, 1, 0);

            case "EMAIL":
                // Mask email: show first char and domain
                // e.g., "user@example.com" -> "u***@example.com"
                const emailAtIndex = identifierValue.indexOf("@");
                if (emailAtIndex > 0) {
                    const firstChar = identifierValue[0];
                    const domain = identifierValue.substring(emailAtIndex);
                    return `${firstChar}***${domain}`;
                }
                return this.genericMask(identifierValue, 1, 0);

            case "MOBILE":
                // Mask mobile: show last 4 digits
                // e.g., "+919876543210" -> "******3210"
                if (identifierValue.length >= 4) {
                    const last4 = identifierValue.substring(identifierValue.length - 4);
                    return "******" + last4;
                }
                return "****";

            case "BANK_ACCOUNT":
                // Mask bank account: show last 4 digits
                // e.g., "1234567890" -> "******7890"
                if (identifierValue.length >= 4) {
                    const last4 = identifierValue.substring(identifierValue.length - 4);
                    return "******" + last4;
                }
                return "****";

            case "CARD_INSTRUMENT":
                // Mask card: show last 4 digits
                // e.g., "4111111111111111" -> "****1111"
                if (identifierValue.length >= 4) {
                    const last4 = identifierValue.substring(identifierValue.length - 4);
                    return "****" + last4;
                }
                return "****";

            case "IFSC":
                // IFSC codes are typically public identifiers, but mask for consistency
                // Show first 2 and last 2 characters
                if (identifierValue.length >= 4) {
                    const first2 = identifierValue.substring(0, 2);
                    const last2 = identifierValue.substring(identifierValue.length - 2);
                    return `${first2}***${last2}`;
                }
                return "****";

            default:
                // Generic masking: show first 1 char and last 1 char
                return this.genericMask(identifierValue, 1, 1);
        }
    }

    /**
     * Generic masking utility.
     * 
     * @param value The value to mask
     * @param prefixLength Number of characters to show at the start
     * @param suffixLength Number of characters to show at the end
     * @returns The masked value
     */
    private static genericMask(value: string, prefixLength: number, suffixLength: number): string {
        if (value.length <= prefixLength + suffixLength) {
            return "****";
        }

        const prefix = value.substring(0, prefixLength);
        const suffix = suffixLength > 0 ? value.substring(value.length - suffixLength) : "";
        const maskLength = value.length - prefixLength - suffixLength;

        return `${prefix}${"*".repeat(Math.min(maskLength, 4))}${suffix}`;
    }
}
