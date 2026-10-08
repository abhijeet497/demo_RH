import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, ArrowRight, Users, Network, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { LLM_UI_FLAG } from "@/lib/llmModels";

export default function AtlasRegistry() {
  const navigate = useNavigate();
  const { enabled: llmEnabled } = useFeatureFlag(LLM_UI_FLAG);

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Hero Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/10">
            <Globe className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Atlas Registry</h1>
            <p className="text-muted-foreground text-lg">Your Security Intelligence Hub</p>
          </div>
        </div>
      </div>

      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle>What is Atlas?</CardTitle>
          <CardDescription>Enterprise-grade security intelligence at your fingertips</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-foreground leading-relaxed">
            Atlas is a comprehensive security registry that provides curated, fine-grained security ratings 
            for publicly available AI agents and connectors (MCP servers). Our expert team continuously 
            evaluates and scores each component across multiple security dimensions, giving you the 
            confidence to make informed decisions about your AI usage.
          </p>
          <div className="grid gap-4 md:grid-cols-3 pt-4">
            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary">500+</div>
              <p className="text-sm text-muted-foreground">Evaluated Components</p>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary">Real-time</div>
              <p className="text-sm text-muted-foreground">Security Updates</p>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary">Fine-grained</div>
              <p className="text-sm text-muted-foreground">Risk Ratings</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/agent-registry')}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>AI Agent Registry</CardTitle>
            </div>
            <CardDescription>
              Explore security ratings for AI agents from leading providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Access comprehensive security assessments for hundreds of AI agents, including 
              ChatGPT, Claude, Copilot, and more. Each agent is evaluated across multiple 
              security criteria to help you understand potential risks.
            </p>
            <Button variant="outline" className="w-full group">
              View AI Agent Registry
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/mcp-registry')}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Network className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Connector Registry</CardTitle>
            </div>
            <CardDescription>
              Browse security ratings for Model Context Protocols
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Discover security evaluations for various connectors used in AI systems. 
              Our curated ratings help you assess the security posture of different 
              protocols before integration.
            </p>
            <Button variant="outline" className="w-full group">
              View Connector Registry
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>

        {llmEnabled && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/llm-model-registry')}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>LLM Model Registry</CardTitle>
              </div>
              <CardDescription>
                Browse publisher, origin and openness for LLM models
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Browse the LLM models available in the catalog, with publisher,
                origin country, and openness classification to help you assess each
                model before use.
              </p>
              <Button variant="outline" className="w-full group">
                View LLM Model Registry
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
