import React, { useEffect, useState } from "react";
import { ModelProfile } from "@/types/fashion";
import { DEFAULT_PROFILES } from "@/data/prompt-layers";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Save, Trash2 } from "lucide-react";

interface ModelProfileStepProps {
  selectedProfile: ModelProfile | null;
  onProfileChange: (profile: ModelProfile) => void;
}

const STORAGE_KEY = "fashion-ai-profiles";

const emptyProfile: ModelProfile = {
  id: "",
  name: "",
  height: "1.70",
  bust: "86",
  waist: "62",
  hip: "90",
  skinTone: "",
  hairType: "",
  hairColor: "",
  generalStyle: "",
};

const ModelProfileStep: React.FC<ModelProfileStepProps> = ({
  selectedProfile,
  onProfileChange,
}) => {
  const [savedProfiles, setSavedProfiles] = useState<ModelProfile[]>([]);
  const [current, setCurrent] = useState<ModelProfile>(
    selectedProfile || emptyProfile
  );

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSavedProfiles(JSON.parse(stored));
    } else {
      setSavedProfiles(DEFAULT_PROFILES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROFILES));
    }
  }, []);

  useEffect(() => {
    onProfileChange(current);
  }, [current, onProfileChange]);

  const selectPreset = (profile: ModelProfile) => {
    setCurrent({ ...profile });
  };

  const saveProfile = () => {
    const toSave = { ...current, id: current.id || crypto.randomUUID(), name: current.name || "Perfil Personalizado" };
    const updated = [...savedProfiles.filter((p) => p.id !== toSave.id), toSave];
    setSavedProfiles(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setCurrent(toSave);
  };

  const deleteProfile = (id: string) => {
    const updated = savedProfiles.filter((p) => p.id !== id);
    setSavedProfiles(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const fields: { key: keyof ModelProfile; label: string; placeholder: string }[] = [
    { key: "name", label: "Nome do Perfil", placeholder: "Ex: Modelo Editorial BR" },
    { key: "height", label: "Altura (m)", placeholder: "1.70" },
    { key: "bust", label: "Busto (cm)", placeholder: "86" },
    { key: "waist", label: "Cintura (cm)", placeholder: "62" },
    { key: "hip", label: "Quadril (cm)", placeholder: "90" },
    { key: "skinTone", label: "Tom de Pele", placeholder: "Bronzeado médio" },
    { key: "hairType", label: "Tipo de Cabelo", placeholder: "Liso ondulado" },
    { key: "hairColor", label: "Cor do Cabelo", placeholder: "Castanho escuro" },
    { key: "generalStyle", label: "Estilo Geral", placeholder: "Editorial" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Perfil de Modelo</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure ou selecione um perfil salvo.
        </p>
      </div>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-2">
        {savedProfiles.map((p) => (
          <div key={p.id} className="flex items-center gap-1">
            <Button
              variant={current.id === p.id ? "default" : "outline"}
              size="sm"
              onClick={() => selectPreset(p)}
              className="text-xs"
            >
              {p.name}
            </Button>
            {!DEFAULT_PROFILES.find((d) => d.id === p.id) && (
              <button
                onClick={() => deleteProfile(p.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Form */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  value={current[f.key]}
                  onChange={(e) =>
                    setCurrent({ ...current, [f.key]: e.target.value })
                  }
                  placeholder={f.placeholder}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={saveProfile}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Salvar Perfil
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ModelProfileStep;
