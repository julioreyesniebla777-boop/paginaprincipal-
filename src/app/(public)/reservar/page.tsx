import type { Metadata } from "next";
import { getBookingData } from "@/server/booking-data";
import { BookingWizard } from "@/components/booking/booking-wizard";

export const metadata: Metadata = { title: "Reservar cita" };

export default async function BookingPage() {
  const { info, services, employees, prefill } = await getBookingData();
  return <BookingWizard business={info} services={services} employees={employees} prefill={prefill} />;
}
