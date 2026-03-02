import React from "react";
import { GarmentAnalysis } from "@/types/fashion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AnalysisCardProps {
  analysis: GarmentAnalysis;
  onUpdate: (analysis: GarmentAnalysis) => void;
}

const fields: { key: keyof GarmentAnalysis; label: string }[] = [
  { key: "type", label: "Tipo de Peça" },
  { key: "fabric", label: "Tecido" },
  { key: "color", label: "Cor" },
  { key: "pattern", label: "Estampa / Padrão" },
  { key: "construction", label: "Construção" },
  { key: "style", label: "Estilo" },
];

const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis, onUpdate }) => {
  return (
    <Card className="border-accent/30">
      <CardContent className="pt-6 space-y-4">
        <h3 className="text-lg font-semibold">Análise Técnica da Peça</h3>
        <p className="text-xs text-muted-foreground">
          Resultados extraídos via IA — edite livremente para corrigir detalhes.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs">{f.label}</Label>
              <Input
                value={analysis[f.key]}
                onChange={(e) =>
                  onUpdate({ ...analysis, [f.key]: e.target.value })
                }
                className="text-sm"
              />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Detalhes Técnicos</Label>
          <Textarea
            value={analysis.details}
            onChange={(e) =>
              onUpdate({ ...analysis, details: e.target.value })
            }
            rows={3}
            className="text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalysisCard;
