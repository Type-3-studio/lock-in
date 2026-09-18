export type ISODate = string;

interface Civil {
  year: number;
  month: number;
  day: number;
}

function truncDiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1] ?? 0;
}

function splitISODate(date: ISODate): Civil {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

function formatISODate({ year, month, day }: Civil): ISODate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

export function toDayNumber(date: ISODate): number {
  const { year, month, day } = splitISODate(date);
  const y = month <= 2 ? year - 1 : year;
  const era = truncDiv(y >= 0 ? y : y - 399, 400);
  const yoe = y - era * 400;
  const doy = truncDiv(153 * (month + (month > 2 ? -3 : 9)) + 2, 5) + day - 1;
  const doe = yoe * 365 + truncDiv(yoe, 4) - truncDiv(yoe, 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromDayNumber(dayNumber: number): ISODate {
  const z = dayNumber + 719468;
  const era = truncDiv(z >= 0 ? z : z - 146096, 146097);
  const doe = z - era * 146097;
  const yoe = truncDiv(
    doe - truncDiv(doe, 1460) + truncDiv(doe, 36524) - truncDiv(doe, 146096),
    365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + truncDiv(yoe, 4) - truncDiv(yoe, 100));
  const mp = truncDiv(5 * doy + 2, 153);
  const day = doy - truncDiv(153 * mp + 2, 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  const year = y + (month <= 2 ? 1 : 0);
  return formatISODate({ year, month, day });
}

export function addDays(date: ISODate, amount: number): ISODate {
  return fromDayNumber(toDayNumber(date) + amount);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return toDayNumber(a) - toDayNumber(b);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function dayOfWeek(date: ISODate): number {
  const mod = ((toDayNumber(date) + 3) % 7 + 7) % 7;
  return mod + 1;
}

export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -(dayOfWeek(date) - 1));
}

export function endOfWeek(date: ISODate): ISODate {
  return addDays(startOfWeek(date), 6);
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: ISODate): ISODate {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return `${date.slice(0, 7)}-${pad(daysInMonth(year, month), 2)}`;
}

export function addMonths(date: ISODate, amount: number): ISODate {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + amount;
  const day = Number(date.slice(8, 10));
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth + 1));
  return `${pad(targetYear, 4)}-${pad(targetMonth + 1, 2)}-${pad(clampedDay, 2)}`;
}

export interface ISOWeek {
  year: number;
  week: number;
}

export function isoWeek(date: ISODate): ISOWeek {
  const thursday = toDayNumber(date) + (4 - dayOfWeek(date));
  const weekYear = splitISODate(fromDayNumber(thursday)).year;
  const jan4 = toDayNumber(`${pad(weekYear, 4)}-01-04`);
  const week1Monday = jan4 - (dayOfWeek(fromDayNumber(jan4)) - 1);
  const currentMonday = thursday - 3;
  return { year: weekYear, week: Math.floor((currentMonday - week1Monday) / 7) + 1 };
}

export function eachDate(start: ISODate, end: ISODate): ISODate[] {
  const dates: ISODate[] = [];
  for (let n = toDayNumber(start); n <= toDayNumber(end); n += 1) {
    dates.push(fromDayNumber(n));
  }
  return dates;
}
