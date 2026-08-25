import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md text-center shadow-sm">
        <CardHeader className="items-center">
          <div className="mb-2 text-5xl font-extrabold tabular-nums text-muted-foreground/40">
            404
          </div>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>
            The page you are looking for does not exist or has moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
