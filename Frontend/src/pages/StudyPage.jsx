import SectionCard from "../components/SectionCard";
import SchedulePage from "./SchedulePage";

export default function StudyPage() {
  return (
    <div className="space-y-6">
      <SectionCard title="Учёба">
        <SchedulePage />
      </SectionCard>
    </div>
  );
}
