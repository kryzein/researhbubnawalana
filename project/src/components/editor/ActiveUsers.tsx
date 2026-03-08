import { useSelf, useOthers } from "@liveblocks/react";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export function ActiveUsers() {
  const currentUser = useSelf();
  const others = useOthers();
  const totalUsers = (currentUser ? 1 : 0) + others.length;

  return (
    <div className="flex items-center gap-2">
      {totalUsers > 1 && (
        <Badge variant="secondary" className="text-xs gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          {totalUsers} editing
        </Badge>
      )}
      <div className="flex items-center gap-0.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground mr-1" />
        <div className="flex -space-x-2">
          {currentUser?.info && (
            <Tooltip>
              <TooltipTrigger>
                <Avatar
                  className="h-6 w-6 border-2 border-background ring-1 transition-transform hover:scale-110 hover:z-10"
                  style={{ ringColor: currentUser.info.color as string }}
                >
                  <AvatarFallback
                    className="text-[10px] font-medium"
                    style={{
                      backgroundColor: currentUser.info.color as string,
                      color: "white",
                    }}
                  >
                    {(currentUser.info.name as string)?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {currentUser.info.name as string} (you)
              </TooltipContent>
            </Tooltip>
          )}
          {others.map((other) => (
            <Tooltip key={other.connectionId}>
              <TooltipTrigger>
                <Avatar
                  className="h-6 w-6 border-2 border-background ring-1 transition-transform hover:scale-110 hover:z-10"
                  style={{ ringColor: other.info?.color as string }}
                >
                  <AvatarFallback
                    className="text-[10px] font-medium"
                    style={{
                      backgroundColor: other.info?.color as string,
                      color: "white",
                    }}
                  >
                    {(other.info?.name as string)?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {other.info?.name as string}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}
