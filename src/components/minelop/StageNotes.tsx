import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type StageNotesProps = {
  stageKey: string;
  stageLabel: string;
  notes: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
};

export const StageNotes = ({ stageKey, stageLabel, notes, onChange, readOnly = false }: StageNotesProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor={`notes-${stageKey}`} className="text-base font-semibold">
        Notater
      </Label>
      <Textarea
        id={`notes-${stageKey}`}
        placeholder={`Notater for ${stageLabel}...`}
        value={notes || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        className="min-h-[150px]"
        disabled={readOnly}
      />
    </div>
  );
};
