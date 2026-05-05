export type ParsedDay = {
  date: string;
  dayOfWeek: number;
  punches: string[];
};

export type ParsedEmployee = {
  personId: string;
  name: string;
  department: string | null;
  days: ParsedDay[];
  totalPunches: number;
};

export type ParsedWorkbook = {
  filename: string;
  periodStart: string;
  periodEnd: string;
  employees: ParsedEmployee[];
  warnings: string[];
};
