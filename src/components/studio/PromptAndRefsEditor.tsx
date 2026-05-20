import React, { useState, useRef } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown, Image as ImageIcon, PenLine, Save, Trash2, Upload } from "lucide-react";

export type RegenScope = "all" | "non-approved";

interface Props {
  prompt: string;
  onPromptChange: (v: string) => void;
  referenceImages: string[];
  onReferenceImagesChange: (imgs: string[]) => void;
  approvedCount: number;
  isBusy?: boolean;
  onSaveAndRegenerate: (scope: RegenScope) => void;
}

const PromptAndRefsEditor: React.FC<Props> = ({
  prompt, onPromptChange, referenceImages, onReferenceImagesChange,
  approvedCount, isBusy, onSaveAndRegenerate,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const dataUrls: string[] = [];
    for (const f of Array.from(files).slice(0, 3 - referenceImages.length)) {
      const reader = new FileReader();
      const url: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(f);
      });
      dataUrls.push(url);
    }
    onReferenceImagesChange([...referenceImages, ...dataUrls].slice(0, 3));
  };

  const removeAt = (idx: number) => {
    onReferenceImagesChange(referenceImages.filter((_, i) => i !== idx));
  };

  const triggerSave = () => {
    if (approvedCount > 0) setConfirmOpen(true);
    else onSaveAndRegenerate("all");
  };

  return (
    <div className="space-y-2 mb-4">
      <Collapsible>
        <div className="rounded-lg border border-border bg-card">
          <CollapsibleTrigger className="w-full flex items-center justify-between p-3 text-left">
            <div className="flex items-center gap-2 text-xs font-medium">
              <PenLine className="h-3.5 w-3.5 text-accent" />
              📝 Prompt
              <Badge variant="secondary" className="text-[10px]">{prompt.length} chars</Badge>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [&[data-state=open]]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pb-3 space-y-2">
            <Textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              rows={8}
              className="text-xs font-mono"
              placeholder="Prompt editável da geração..."
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={triggerSave} disabled={isBusy} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Salvar e Regenerar
              </Button>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <Collapsible>
        <div className="rounded-lg border border-border bg-card">
          <CollapsibleTrigger className="w-full flex items-center justify-between p-3 text-left">
            <div className="flex items-center gap-2 text-xs font-medium">
              <ImageIcon className="h-3.5 w-3.5 text-accent" />
              🖼️ Imagens de referência
              <Badge variant="secondary" className="text-[10px]">{referenceImages.length}/3</Badge>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [&[data-state=open]]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pb-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {referenceImages.map((src, idx) => (
                <div key={idx} className="relative group">
                  <img src={src} alt={`ref-${idx}`} className="h-20 w-20 object-cover rounded-md border border-border" />
                  <button
                    type="button"
                    onClick={() => removeAt(idx)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {referenceImages.length < 3 && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="h-20 w-20 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center text-[10px] text-muted-foreground hover:text-foreground hover:border-accent"
                >
                  <Upload className="h-4 w-4 mb-1" />
                  Adicionar
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={triggerSave} disabled={isBusy} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Salvar e Regenerar
              </Button>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regerar com proteção de aprovadas?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem {approvedCount} foto(s) aprovada(s). Deseja regerar todos os shots
              ou manter as aprovadas intactas e regerar apenas as não aprovadas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); onSaveAndRegenerate("non-approved"); }}>
              Apenas não aprovadas
            </Button>
            <AlertDialogAction onClick={() => onSaveAndRegenerate("all")}>
              Regerar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PromptAndRefsEditor;
