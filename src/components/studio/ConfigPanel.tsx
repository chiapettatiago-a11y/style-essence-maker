import React, { useState, useCallback } from "react";
import { GarmentAnalysis, GenerationRequest, ModelProfile } from "@/types/fashion";
import { Upload, X, ImageIcon, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DEFAULT_PROFILES, STYLE_CATEGORIES } from "@/data/prompt-layers";
import { LAYER1_BASE } from "@/data/prompt-layers";
import { assembleLayer2, generateAllRequests } from "@/data/prompt-builder";
import { Save, Sparkles, User, Move, Image, Video, Palette, PenLine, Lock } from "lucide-react";

type ActiveSection = "upload" | "model" | "style" | "generate";

interface ConfigPanelProps {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
  // Upload
  uploadedImages: string[];
  onImagesChange: (images: string[]) => void;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  garmentAnalysis: GarmentAnalysis | null;
  onAnalysisUpdate: (a: GarmentAnalysis) => void;
  // Model
  selectedProfile: ModelProfile | null;
  onProfileChange: (p: ModelProfile) => void;
  // Styles
  selectedPresets: Record<string, string>;
  onPresetsChange: (p: Record<string, string>) => void;
  // Generation
  manualPrompt: string;
  onManualPromptChange: (v: string) => void;
  onGenerate: (requests: GenerationRequest[]) => void;
  isGenerating: boolean;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  User: <User className="h-3.5 w-3.5" />,
  Move: <Move className="h-3.5 w-3.5" />,
  Image: <Image className="h-3.5 w-3.5" />,
  Sparkles: <Sparkles className="h-3.5 w-3.5" />,
  Video: <Video className="h-3.5 w-3.5" />,
};

const STORAGE_KEY = "fashion-ai-profiles";

const emptyProfile: ModelProfile = {
  id: "", name: "", height: "1.70", bust: "86", waist: "62", hip: "90",
  skinTone: "", hairType: "", hairColor: "", generalStyle: "",
};

const SectionButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: string;
}> = ({ label, icon, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-all w-full text-left",
      active ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
    )}
  >
    {icon}
    <span className="flex-1">{label}</span>
    {badge && (
      <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">{badge}</span>
    )}
  </button>
);

const ConfigPanel: React.FC<ConfigPanelProps> = ({
  activeSection, onSectionChange,
  uploadedImages, onImagesChange, isAnalyzing, onAnalyze,
  garmentAnalysis, onAnalysisUpdate,
  selectedProfile, onProfileChange,
  selectedPresets, onPresetsChange,
  manualPrompt, onManualPromptChange,
  onGenerate, isGenerating,
}) => {
  const [dragOver, setDragOver] = useState(false);

  // Model profile state
  const [savedProfiles, setSavedProfiles] = useState<ModelProfile[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_PROFILES;
  });
  const [currentProfile, setCurrentProfile] = useState<ModelProfile>(selectedProfile || emptyProfile);

  const handleFiles = useCallback((files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        onImagesChange([...uploadedImages, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }, [uploadedImages, onImagesChange]);

  const updateProfile = (p: ModelProfile) => {
    setCurrentProfile(p);
    onProfileChange(p);
  };

  const saveProfile = () => {
    const toSave = { ...currentProfile, id: currentProfile.id || crypto.randomUUID(), name: currentProfile.name || "Perfil Personalizado" };
    const updated = [...savedProfiles.filter((p) => p.id !== toSave.id), toSave];
    setSavedProfiles(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    updateProfile(toSave);
  };

  const layer2Text = assembleLayer2(selectedPresets);
  const requests = generateAllRequests(
    { layer1: LAYER1_BASE, layer2: layer2Text, layer3: manualPrompt },
    garmentAnalysis,
    selectedProfile
  );

  const togglePreset = (categoryId: string, presetId: string) => {
    if (selectedPresets[categoryId] === presetId) {
      const next = { ...selectedPresets };
      delete next[categoryId];
      onPresetsChange(next);
    } else {
      onPresetsChange({ ...selectedPresets, [categoryId]: presetId });
    }
  };

  const profileFields: { key: keyof ModelProfile; label: string; placeholder: string }[] = [
    { key: "name", label: "Nome", placeholder: "Modelo Editorial BR" },
    { key: "height", label: "Altura", placeholder: "1.70" },
    { key: "bust", label: "Busto", placeholder: "86" },
    { key: "waist", label: "Cintura", placeholder: "62" },
    { key: "hip", label: "Quadril", placeholder: "90" },
    { key: "skinTone", label: "Pele", placeholder: "Bronzeado médio" },
    { key: "hairType", label: "Cabelo", placeholder: "Liso ondulado" },
    { key: "hairColor", label: "Cor Cabelo", placeholder: "Castanho escuro" },
    { key: "generalStyle", label: "Estilo", placeholder: "Editorial" },
  ];

  const analysisFields: { key: keyof GarmentAnalysis; label: string }[] = [
    { key: "type", label: "Tipo" },
    { key: "fabric", label: "Tecido" },
    { key: "color", label: "Cor" },
    { key: "length", label: "Comprimento" },
    { key: "silhouette", label: "Silhueta" },
    { key: "neckline", label: "Decote/Gola" },
    { key: "sleeves", label: "Mangas" },
    { key: "hemline", label: "Barra" },
    { key: "pattern", label: "Padrão" },
    { key: "construction", label: "Construção" },
    { key: "style", label: "Estilo" },
  ];

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      {/* Section nav */}
      <div className="px-3 py-3 border-b border-border space-y-0.5">
        <SectionButton
          label="Upload & Análise"
          icon={<Upload className="h-3.5 w-3.5" />}
          active={activeSection === "upload"}
          onClick={() => onSectionChange("upload")}
          badge={uploadedImages.length > 0 ? `${uploadedImages.length}` : undefined}
        />
        <SectionButton
          label="Perfil de Modelo"
          icon={<User className="h-3.5 w-3.5" />}
          active={activeSection === "model"}
          onClick={() => onSectionChange("model")}
          badge={selectedProfile ? "✓" : undefined}
        />
        <SectionButton
          label="Estilos"
          icon={<Palette className="h-3.5 w-3.5" />}
          active={activeSection === "style"}
          onClick={() => onSectionChange("style")}
          badge={Object.keys(selectedPresets).length > 0 ? `${Object.keys(selectedPresets).length}` : undefined}
        />
        <SectionButton
          label="Gerar"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          active={activeSection === "generate"}
          onClick={() => onSectionChange("generate")}
        />
      </div>

      {/* Section content */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* UPLOAD SECTION */}
          {activeSection === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file"; input.accept = "image/*"; input.multiple = true;
                  input.onchange = (e) => { const files = (e.target as HTMLInputElement).files; if (files) handleFiles(files); };
                  input.click();
                }}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
                  dragOver ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
                )}
              >
                <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-xs font-medium">Arraste ou clique</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {uploadedImages.length} imagens • PNG, JPG
                </p>
              </div>

              <Button
                onClick={onAnalyze}
                disabled={uploadedImages.length === 0 || isAnalyzing || !!garmentAnalysis}
                className="w-full"
                size="sm"
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Analisando...
                  </span>
                ) : garmentAnalysis ? (
                  <span className="flex items-center gap-1.5"><ImageIcon className="h-3 w-3" /> Análise concluída ✓</span>
                ) : (
                  "Analisar Peça"
                )}
              </Button>

              {garmentAnalysis && (
                <div className="space-y-3 border-t border-border pt-3">
                  <h4 className="text-xs font-semibold text-accent">Análise Técnica</h4>
                  <div className="space-y-2">
                    {analysisFields.map((f) => (
                      <div key={f.key} className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
                        <Input
                          value={garmentAnalysis[f.key]}
                          onChange={(e) => onAnalysisUpdate({ ...garmentAnalysis, [f.key]: e.target.value })}
                          className="text-xs h-7"
                        />
                      </div>
                    ))}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Detalhes</Label>
                      <Textarea
                        value={garmentAnalysis.details}
                        onChange={(e) => onAnalysisUpdate({ ...garmentAnalysis, details: e.target.value })}
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODEL SECTION */}
          {activeSection === "model" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {savedProfiles.map((p) => (
                  <Button
                    key={p.id}
                    variant={currentProfile.id === p.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateProfile({ ...p })}
                    className="text-[10px] h-6 px-2"
                  >
                    {p.name}
                  </Button>
                ))}
              </div>

              <div className="space-y-2">
                {profileFields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
                    <Input
                      value={currentProfile[f.key]}
                      onChange={(e) => updateProfile({ ...currentProfile, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="text-xs h-7"
                    />
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" className="w-full text-xs" onClick={saveProfile}>
                <Save className="h-3 w-3 mr-1.5" /> Salvar Perfil
              </Button>
            </div>
          )}

          {/* STYLE SECTION */}
          {activeSection === "style" && (
            <div className="space-y-4">
              {STYLE_CATEGORIES.map((category) => (
                <div key={category.id} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <span className="text-accent">{ICON_MAP[category.icon]}</span>
                    {category.label}
                  </div>
                  <div className="space-y-1">
                    {category.presets.map((preset) => {
                      const isSelected = selectedPresets[category.id] === preset.id;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => togglePreset(category.id, preset.id)}
                          className={cn(
                            "w-full text-left p-2 rounded-md border transition-all",
                            isSelected
                              ? "border-accent bg-accent/10"
                              : "border-border hover:border-accent/40 bg-background"
                          )}
                        >
                          <p className="text-xs font-medium">{preset.name}</p>
                          <p className="text-[10px] text-muted-foreground">{preset.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* GENERATE SECTION */}
          {activeSection === "generate" && (
            <div className="space-y-4">
              {/* Manual prompt */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <PenLine className="h-3 w-3 text-layer-manual" />
                  Ajuste Manual
                </Label>
                <Textarea
                  value={manualPrompt}
                  onChange={(e) => onManualPromptChange(e.target.value)}
                  placeholder="Vento suave no cabelo, foco no detalhe da gola..."
                  rows={3}
                  className="text-xs"
                />
              </div>

              {/* Request count */}
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                <span className="font-medium text-foreground">
                  {requests.filter((r) => r.type !== "video-product" && r.type !== "video-model").length} imagens
                </span>
                {" + "}
                <span className="font-medium text-foreground">
                  {requests.filter((r) => r.type === "video-product" || r.type === "video-model").length} prompts de vídeo
                </span>
                {" serão gerados"}
              </div>

              <Button
                onClick={() => onGenerate(requests)}
                disabled={isGenerating}
                className="w-full"
                size="sm"
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Gerando...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    Gerar Pacote
                  </span>
                )}
              </Button>

              {/* Prompt previews collapsed */}
              <div className="border-t border-border pt-3 space-y-2">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Preview dos Prompts
                </h4>
                {requests.map((req) => (
                  <details key={req.type} className="group">
                    <summary className="text-xs font-medium cursor-pointer hover:text-accent transition-colors list-none flex items-center gap-1">
                      <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
                      {req.label}
                    </summary>
                    <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono mt-1 ml-4 max-h-24 overflow-y-auto">
                      {req.prompt}
                    </pre>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ConfigPanel;
