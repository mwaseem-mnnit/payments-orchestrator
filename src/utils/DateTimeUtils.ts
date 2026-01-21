
// Direct Date usage is forbidden. Use Clock.
export class DateTimeUtils {
    static isBefore(dateA: Date, dateB: Date): boolean {
        return dateA.getTime() < dateB.getTime();
    }

    static isAfter(dateA: Date, dateB: Date): boolean {
        return dateA.getTime() > dateB.getTime();
    }

    static isEqual(dateA: Date, dateB: Date): boolean {
        return dateA.getTime() === dateB.getTime();
    }

    static addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    static addMonths(date: Date, months: number): Date {
        const result = new Date(date);
        result.setMonth(result.getMonth() + months);
        return result;
    }

    static addYears(date: Date, years: number): Date {
        const result = new Date(date);
        result.setFullYear(result.getFullYear() + years);
        return result;
    }

    static diffInDays(dateA: Date, dateB: Date): number {
        const diffTime = dateA.getTime() - dateB.getTime();
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    static diffInMonths(dateA: Date, dateB: Date): number {
        const yearDiff = dateA.getFullYear() - dateB.getFullYear();
        const monthDiff = dateA.getMonth() - dateB.getMonth();
        return yearDiff * 12 + monthDiff;
    }

    static diffInYears(dateA: Date, dateB: Date): number {
        return dateA.getFullYear() - dateB.getFullYear();
    }

    static isWithinRange(
        date: Date,
        startDate: Date,
        endDate: Date
    ): boolean {
        const dateTime = date.getTime();
        const startTime = startDate.getTime();
        const endTime = endDate.getTime();
        return dateTime >= startTime && dateTime <= endTime;
    }
}

