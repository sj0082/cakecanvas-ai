import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw } from "lucide-react";

interface Preset {
  id: string;
  name: string;
  version: string;
}

interface PresetSelectorProps {
  presets: Preset[];
  selectedPreset: string;
  onPresetChange: (presetId: string) => void;
  onSaveAsNew: () => void;
  onRevert: () => void;
}

const defaultPresets: Preset[] = [
  { id: "wedding-classic-v3", name: "Wedding Classic", version: "v3" },
  { id: "minimal-white-v2", name: "Minimal White", version: "v2" },
  { id: "rustic-floral-v1", name: "Rustic Floral", version: "v1" },
  { id: "kids-pastel-v1", name: "Kids Pastel", version: "v1" },
  { id: "modern-geometric-v2", name: "Modern Geometric", version: "v2" },
  { id: "vintage-elegant-v1", name: "Vintage Elegant", version: "v1" },
];

export const PresetSelector = ({
  presets = defaultPresets,
  selectedPreset,
  onPresetChange,
  onSaveAsNew,
  onRevert,
}: PresetSelectorProps) => {
  return (
    <div className="flex items-center gap-2">
      <Select value={selectedPreset} onValueChange={onPresetChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select preset..." />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              {preset.name} {preset.version}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={onSaveAsNew} className="gap-2">
        <Save className="h-4 w-4" />
        Save as New
      </Button>
      <Button variant="outline" size="sm" onClick={onRevert} className="gap-2">
        <RotateCcw className="h-4 w-4" />
        Revert
      </Button>
    </div>
  );
};
