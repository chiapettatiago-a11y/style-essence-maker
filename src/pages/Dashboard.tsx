import React, { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, LogOut, Loader2, Trash2, Sparkles, ArrowRight, Calendar, FolderOpen, User, Pencil, Check, X, SortAsc, Image as ImageIcon, DollarSign, Cpu, ChevronDown, ChevronRight } from "lucide-react";
import monograma from "@/assets/monograma.png";
import { useToast } from "@/hooks/use-toast";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import CollectionDialog from "@/components/collections/CollectionDialog";
import type { Collection } from "@/types/fashion";

type SortMode = "name" | "date" | "objective";

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCode, setEditingCode] = useState("");
  const [uncategorizedOpen, setUncategorizedOpen] = useState(false);

  // Queries
  const { data: collections, isLoading: collectionsLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Collection[];
    },
    enabled: !!user,
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, created_at, updated_at, collection_id, product_code")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Stats queries
  const { data: allLaunches } = useQuery({
    queryKey: ["all-launches-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("weekly_launches").select("id, product_id, engine_used, total_cost_usd");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: allImages } = useQuery({
    queryKey: ["all-images-stats"],
    queryFn: async () => {
      if (!allLaunches || allLaunches.length === 0) return [];
      const ids = allLaunches.map((l) => l.id);
      const { data, error } = await supabase.from("generated_images").select("id, status, type, model_used, generation_cost_usd").in("launch_id", ids);
      if (error) throw error;
      return data;
    },
    enabled: !!allLaunches && allLaunches.length > 0,
  });

  const stats = useMemo(() => {
    const imgs = allImages || [];
    const doneImages = imgs.filter((i) => i.status === "done" && i.type !== "video-product" && i.type !== "video-model");
    const totalCost = imgs.reduce((sum, i) => sum + (Number(i.generation_cost_usd) || 0), 0);
    const engines = new Map<string, number>();
    doneImages.forEach((i) => {
      const e = i.model_used || "unknown";
      engines.set(e, (engines.get(e) || 0) + 1);
    });
    return {
      totalPhotos: doneImages.length,
      totalProducts: (products || []).length,
      totalCollections: (collections || []).length,
      totalCost,
      engines: Array.from(engines.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3),
    };
  }, [allImages, products, collections]);

  // Mutations
  const createCollection = useMutation({
    mutationFn: async (data: { name: string; description: string; season: string; objective: string; color_tag: string }) => {
      const { error } = await supabase.from("collections").insert({ ...data, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setCollectionDialogOpen(false);
      toast({ title: "Coleção criada" });
    },
  });

  const deleteCollection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setSelectedCollectionId(null);
    },
  });

  const createProduct = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("products")
        .insert({ name, user_id: user!.id, collection_id: selectedCollectionId || undefined })
        .select("id")
        .single();
      if (error) throw error;
      const { error: weekError } = await supabase.from("weekly_launches").insert({ product_id: data.id, label: "Semana 1" });
      if (weekError) throw weekError;
      return data.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
      setNewName("");
      navigate(`/project/${id}?new=1`);
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, name, product_code }: { id: string; name: string; product_code: string }) => {
      const { error } = await supabase.from("products").update({ name, product_code }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditingProductId(null);
    },
  });

  // Derived state
  const isLoading = collectionsLoading || productsLoading;

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let list = selectedCollectionId
      ? products.filter((p) => p.collection_id === selectedCollectionId)
      : products;

    const sorted = [...list];
    if (sortMode === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortMode === "date") sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return sorted;
  }, [products, selectedCollectionId, sortMode]);

  const uncategorized = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => !p.collection_id);
  }, [products]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const hasProducts = products && products.length > 0;
  const hasCollections = collections && collections.length > 0;
  const showCollections = !selectedCollectionId;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <img src={monograma} alt="Monograma" className="h-5 brightness-0 invert dark:invert cursor-pointer" onClick={() => { setSelectedCollectionId(null); }} />
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <div className="w-px h-5 bg-border" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/perfil")}>
              <User className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : !hasProducts && !hasCollections ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-20 space-y-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-3 max-w-lg">
              <h1 className="text-3xl font-bold tracking-tight">Bem-vindo ao Fashion AI Studio</h1>
              <p className="text-muted-foreground leading-relaxed">
                Crie lookbooks profissionais com IA. Organize por coleções, faça upload das fotos no cabide, escolha o modelo e gere imagens editoriais em poucos cliques.
              </p>
            </div>
            <div className="flex gap-3">
              <Button size="lg" className="gap-2" onClick={() => setCollectionDialogOpen(true)}>
                <FolderOpen className="h-4 w-4" /> Criar Coleção
              </Button>
              <Button size="lg" variant="outline" className="gap-2" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" /> Criar Produto
              </Button>
            </div>
          </div>
        ) : showCollections ? (
          <>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Início</span>
            </div>

            {/* Collections Section */}
            <div className="flex items-end justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Coleções</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {(collections || []).length} coleção{(collections || []).length !== 1 ? "ões" : ""} • {uncategorized.length} sem coleção
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <SortAsc className="h-3.5 w-3.5" /> Ordenar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setSortMode("name")}>Nome A-Z</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortMode("date")}>Data</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortMode("objective")}>Objetivo</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={() => setCollectionDialogOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Nova Coleção
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Novo Produto
                </Button>
              </div>
            </div>

            {/* Stats Dashboard */}
            {(stats.totalPhotos > 0 || stats.totalProducts > 0) && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ImageIcon className="h-4 w-4 text-accent" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Fotos geradas</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalPhotos}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <FolderOpen className="h-4 w-4 text-accent" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Produtos</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalProducts}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-accent" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Custo total</span>
                  </div>
                  <p className="text-2xl font-bold">${stats.totalCost.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Cpu className="h-4 w-4 text-accent" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Motor principal</span>
                  </div>
                  <p className="text-sm font-semibold truncate">{stats.engines[0]?.[0] || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">{stats.engines[0]?.[1] || 0} gerações</p>
                </div>
              </div>
            )}

            {/* Collections Section */}
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Coleções</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {(collections || []).length} coleção{(collections || []).length !== 1 ? "ões" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <SortAsc className="h-3.5 w-3.5" /> Ordenar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setSortMode("name")}>Nome A-Z</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortMode("date")}>Data</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortMode("objective")}>Objetivo</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={() => setCollectionDialogOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Nova Coleção
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Novo Produto
                </Button>
              </div>
            </div>

            {/* Collection cards */}
            {hasCollections && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {collections!.map((col) => {
                  const productCount = (products || []).filter((p) => p.collection_id === col.id).length;
                  return (
                    <div
                      key={col.id}
                      className="group relative rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => setSelectedCollectionId(col.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: col.color_tag || "#6366f1" }} />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold truncate">{col.name}</h3>
                          {col.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{col.description}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            {col.season && <Badge variant="outline" className="text-[10px]">{col.season}</Badge>}
                            {col.objective && <Badge variant="secondary" className="text-[10px]">{col.objective}</Badge>}
                            <span className="text-[10px] text-muted-foreground">{productCount} produto{productCount !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute bottom-3 right-3 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir coleção "${col.name}"?`)) deleteCollection.mutate(col.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Uncategorized products - collapsible */}
            {uncategorized.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => setUncategorizedOpen(!uncategorizedOpen)}
                  className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
                >
                  {uncategorizedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Sem coleção ({uncategorized.length})
                </button>
                {uncategorizedOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {uncategorized.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        isEditing={editingProductId === p.id}
                        editingName={editingName}
                        editingCode={editingCode}
                        onStartEdit={() => { setEditingProductId(p.id); setEditingName(p.name); setEditingCode(p.product_code || ""); }}
                        onCancelEdit={() => setEditingProductId(null)}
                        onSaveEdit={() => updateProduct.mutate({ id: p.id, name: editingName, product_code: editingCode })}
                        onNameChange={setEditingName}
                        onCodeChange={setEditingCode}
                        onNavigate={() => navigate(`/project/${p.id}`)}
                        onDelete={() => deleteProduct.mutate(p.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* ── Inside a collection ── */
          <>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-4 text-xs">
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setSelectedCollectionId(null)}>Início</button>
              <span className="text-muted-foreground">&gt;</span>
              <span className="font-medium">{collections?.find((c) => c.id === selectedCollectionId)?.name}</span>
            </div>

            <div className="flex items-end justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{collections?.find((c) => c.id === selectedCollectionId)?.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Novo Produto
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  isEditing={editingProductId === p.id}
                  editingName={editingName}
                  editingCode={editingCode}
                  onStartEdit={() => { setEditingProductId(p.id); setEditingName(p.name); setEditingCode(p.product_code || ""); }}
                  onCancelEdit={() => setEditingProductId(null)}
                  onSaveEdit={() => updateProduct.mutate({ id: p.id, name: editingName, product_code: editingCode })}
                  onNameChange={setEditingName}
                  onCodeChange={setEditingCode}
                  onNavigate={() => navigate(`/project/${p.id}`)}
                  onDelete={() => deleteProduct.mutate(p.id)}
                />
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhum produto nesta coleção.</p>
                <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Adicionar Produto
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Create product dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Produto</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) createProduct.mutate(newName.trim());
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nome do produto</Label>
              <Input placeholder="Ex: Vestido TR001" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            </div>
            <Button type="submit" className="w-full" disabled={createProduct.isPending || !newName.trim()}>
              {createProduct.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create collection dialog */}
      <CollectionDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
        onSubmit={async (data) => { await createCollection.mutateAsync(data); }}
      />
    </div>
  );
};

// ProductCard with inline editing
interface ProductCardProps {
  product: { id: string; name: string; updated_at: string; product_code?: string | null };
  isEditing: boolean;
  editingName: string;
  editingCode: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onNameChange: (v: string) => void;
  onCodeChange: (v: string) => void;
  onNavigate: () => void;
  onDelete: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product, isEditing, editingName, editingCode,
  onStartEdit, onCancelEdit, onSaveEdit, onNameChange, onCodeChange, onNavigate, onDelete,
}) => {
  if (isEditing) {
    return (
      <div className="rounded-xl border border-accent bg-card p-5 space-y-3">
        <Input
          value={editingName}
          onChange={(e) => onNameChange(e.target.value)}
          autoFocus
          placeholder="Nome"
          className="h-8 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
        />
        <Input
          value={editingCode}
          onChange={(e) => onCodeChange(e.target.value)}
          placeholder="Código (ex: TR001)"
          className="h-8 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
        />
        <div className="flex gap-2">
          <Button size="sm" className="h-7 text-xs gap-1" onClick={onSaveEdit}>
            <Check className="h-3 w-3" /> Salvar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={onCancelEdit}>
            <X className="h-3 w-3" /> Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
      onClick={onNavigate}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold truncate">{product.name}</h3>
          {product.product_code && <p className="text-[10px] text-muted-foreground mt-0.5">Cód: {product.product_code}</p>}
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{new Date(product.updated_at).toLocaleDateString("pt-BR")}</span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
      </div>
      <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onStartEdit(); }}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

export default Dashboard;
