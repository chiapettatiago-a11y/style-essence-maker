import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, User } from "lucide-react";
import monograma from "@/assets/monograma.png";

const ProfilePage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={monograma} alt="Logo" className="h-5 brightness-0 invert cursor-pointer" onClick={() => navigate("/")} />
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/")}>
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">{user.email}</p>
                <p className="text-sm text-muted-foreground">ID: {user.id.substring(0, 8)}...</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <h2 className="text-sm font-semibold">Status dos Motores</h2>
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="gap-1.5">
                <Check className="h-3 w-3 text-green-500" /> Gemini
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <Check className="h-3 w-3 text-green-500" /> fal.ai
              </Badge>
              <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                Veo 3 — em breve
              </Badge>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ProfilePage;
