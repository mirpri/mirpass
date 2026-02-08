import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

const toLocal = (dateStr?: string) => (dateStr ? dayjs.utc(dateStr).local() : null);

export const formatDateTime = (dateStr?: string) => {
  const local = toLocal(dateStr);
  return local ? local.format("YYYY-MM-DD HH:mm:ss") : "-";
};

export const formatDate = (dateStr?: string) => {
  const local = toLocal(dateStr);
  return local ? local.format("YYYY-MM-DD") : "-";
};

export const parseDate = (dateStr: string) => toLocal(dateStr);

export const toUtcDateString = (date: dayjs.Dayjs) => date.utc().format("YYYY-MM-DD");
