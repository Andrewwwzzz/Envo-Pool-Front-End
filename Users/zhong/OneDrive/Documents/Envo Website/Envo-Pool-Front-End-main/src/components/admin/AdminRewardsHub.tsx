import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RewardsTab from "./RewardsTab";
import RewardCatalogTab from "./RewardCatalogTab";
import MultiplierEventsTab from "./MultiplierEventsTab";
import { useMultiplierEvents, isMultiplierLive } from "@/hooks/usePoints";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

export default function AdminRewardsHub({
  onCustomerClick,
}: {
  onCustomerClick?: (info: { id?: string; email: string; name: string }) => void;
}) {
  const { data: multipliers = [] } = useMultiplierEvents();
  const live = multipliers.find(isMultiplierLive);

  return (
    <Tabs defaultValue="codes" className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <TabsList>
          <TabsTrigger value="codes">Reward Codes</TabsTrigger>
          <TabsTrigger value="catalog">Reward Catalog</TabsTrigger>
          <TabsTrigger value="multipliers">Multiplier Events</TabsTrigger>
        </TabsList>
        {live && (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40">
            <Zap className="h-3 w-3 mr-1" /> {live.multiplier}x · {live.name}
          </Badge>
        )}
      </div>
      <TabsContent value="codes"><RewardsTab onCustomerClick={onCustomerClick} /></TabsContent>
      <TabsContent value="catalog"><RewardCatalogTab /></TabsContent>
      <TabsContent value="multipliers"><MultiplierEventsTab /></TabsContent>
    </Tabs>
  );
}
