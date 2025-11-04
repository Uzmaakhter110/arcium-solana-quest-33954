import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Lock, TrendingUp, LogOut, Wallet } from "lucide-react";
import { MarketCard } from "@/components/MarketCard";
import { BettingPanel } from "@/components/BettingPanel";
import { MarketCreator } from "@/components/MarketCreator";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Market {
  id: string;
  title: string;
  outcomeA: string;
  outcomeB: string;
  priceA: number;
  priceB: number;
  volume: number;
  endTime: string;
  status: string;
}

const Index = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Fetch user profile and balance
  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("sol_balance")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching profile:", error);
        } else if (data) {
          setSolBalance(data.sol_balance ? parseFloat(data.sol_balance.toString()) : 0);
        }
      };

      fetchProfile();
      
      // Listen for balance updates from bets
      const handleBalanceUpdate = () => {
        fetchProfile();
      };
      
      window.addEventListener('balance-updated', handleBalanceUpdate);
      return () => window.removeEventListener('balance-updated', handleBalanceUpdate);
    }
  }, [user]);

  // Fetch markets from database with realtime updates
  useEffect(() => {
    if (!user) return;

    const fetchMarkets = async () => {
      const { data, error } = await supabase
        .from("markets")
        .select("*")
        .eq("status", "Active")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching markets:", error);
        toast.error("Failed to load markets");
      } else if (data) {
        const formattedMarkets: Market[] = data.map(m => ({
          id: m.id,
          title: m.title,
          outcomeA: m.outcome_a,
          outcomeB: m.outcome_b,
          priceA: typeof m.price_a === 'string' ? parseFloat(m.price_a) : m.price_a,
          priceB: typeof m.price_b === 'string' ? parseFloat(m.price_b) : m.price_b,
          volume: typeof m.volume === 'string' ? parseFloat(m.volume) : m.volume,
          endTime: m.end_time,
          status: m.status,
        }));
        setMarkets(formattedMarkets);
        if (formattedMarkets.length > 0 && !selectedMarket) {
          setSelectedMarket(formattedMarkets[0]);
        }
      }
      setIsLoadingData(false);
    };

    fetchMarkets();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('markets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'markets'
        },
        () => {
          fetchMarkets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedMarket]);

  const handleCreateMarket = async (marketData: Omit<Market, 'id'>) => {
    if (!user) return;

    const { error } = await supabase
      .from("markets")
      .insert({
        title: marketData.title,
        outcome_a: marketData.outcomeA,
        outcome_b: marketData.outcomeB,
        price_a: marketData.priceA,
        price_b: marketData.priceB,
        volume: marketData.volume,
        end_time: marketData.endTime,
        status: marketData.status,
        created_by: user.id,
      });

    if (error) {
      console.error("Error creating market:", error);
      toast.error("Failed to create market");
    } else {
      toast.success("Market created successfully!");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (authLoading || isLoadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <header className="mb-8 border-b border-primary/30 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground flex items-center">
              <Zap className="w-7 h-7 text-primary mr-3" />
              Arcium x Solana Prediction Market
            </h1>
            <p className="text-sm text-muted-foreground mt-2 flex items-center">
              <Lock className="w-4 h-4 text-secondary mr-2" />
              Permissionless, Fair Prediction & Opinion Markets. Built on Arcium Confidential Computing.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Your Balance</p>
              <p className="text-lg font-bold text-primary flex items-center">
                <Wallet className="w-4 h-4 mr-1" />
                {solBalance.toFixed(2)} SOL
              </p>
            </div>
            <Button onClick={handleSignOut} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <MarketCreator onCreateMarket={handleCreateMarket} />

          <div>
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center border-t border-border pt-4">
              <TrendingUp className="w-5 h-5 text-primary mr-2" />
              Live Markets ({markets.length})
            </h2>
            <div className="space-y-4">
              {markets.map(market => (
                <MarketCard
                  key={market.id}
                  market={market}
                  onSelect={setSelectedMarket}
                  selected={selectedMarket}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center">
            <Lock className="w-5 h-5 text-primary mr-2" />
            Place Your Opinion
          </h2>
          <BettingPanel market={selectedMarket} />
        </div>
      </div>

      <footer className="mt-12 text-center text-xs text-muted-foreground border-t border-border pt-6">
        <p className="mb-2">
          Disclaimer: This is a demonstration of a Confidential Prediction Market on Solana utilizing Arcium's MPC for fair, private settlement.
        </p>
        <p className="mb-2">
          Platform charges a 5% fee on profits from winning bets to maintain and improve the service.
        </p>
        <p>
          Transaction confirmations and price streams are simulated for real-time responsiveness.
        </p>
      </footer>
    </div>
  );
};

export default Index;
