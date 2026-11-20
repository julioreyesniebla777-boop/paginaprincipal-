import type { Metadata } from "next";
import { getBookingData } from "@/server/booking-data";
import { BookingWizard } from "@/components/booking/booking-wizard";

export const metadata: Metadata = { title: "Reservar cita", robots: { index: false } };

/** Versión sin cabecera para incrustar en otro sitio mediante iframe. */
export default async function EmbedBookingPage() {
  const { info, services, employees, prefill } = await getBookingData();
  return (
    <div className="px-3 py-4">
      <BookingWizard business={info} services={services} employees={employees} prefill={prefill} />
    </div>
  );
}
