import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const OBJECTIVES = [
  "Ensaio Editorial",
  "E-commerce",
  "Campanha",
  "Lookbook",
];

const COLOR_OPTIONS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
];

interface CollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description: string; season: string; objective: string; color_tag: string }) => Promise<void>;
  initialData?: { name: string; description: string; season: string; objective: string; color_tag: string };
  isEditing?: boolean;
}

const CollectionDialog: React.FC<CollectionDialogProps> = ({ open, onOpenChange, onSubmit, initialData, isEditing }) => {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [season, setSeason] = useState(initialData?.season || "");
  const [objective, setObjective] = useState(initialData?.objective || "");
  const [colorTag, setColorTag] = useState(initialData?.color_tag || "#6366f1");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), description, season, objective, color_tag: colorTag });
      if (!isEditing) {
        setName(""); setDescription(""); setSeason(""); setObjective(""); setColorTag("#6366f1");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Coleção" : "Nova Coleção"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Nome da coleção</Label>
            <Input placeholder="Ex: Verão 2026" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Descrição</Label>
            <Textarea placeholder="Descrição opcional..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Temporada</Label>
              <Input placeholder="Ex: SS26" value={season} onChange={(e) => setSeason(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Objetivo</Label>
              <Select value={objective} onValueChange={setObjective}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {OBJECTIVES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Cor</Label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColorTag(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${colorTag === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={submitting || !name.trim()}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Salvar" : "Criar Coleção"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CollectionDialog;
