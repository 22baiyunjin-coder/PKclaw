import { CompanionDesk } from "@/components/CompanionDesk";

export default function GamePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_28%),linear-gradient(180deg,#020617_0%,#07111d_38%,#02040a_100%)] px-4 py-5 sm:px-6 lg:px-8">
      <CompanionDesk />
    </main>
  );
}
