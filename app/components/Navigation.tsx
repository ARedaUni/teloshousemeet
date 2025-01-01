"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Home, FileText, Settings, Menu, LogOut } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { useState } from "react";
import { ModeToggle } from "./mode-toggle";
import { DialogTitle } from "@/components/ui/dialog";

export function Navigation() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  if (!session) return null;

  const routes = [
    {
      href: "/",
      label: "Home",
      icon: Home,
      active: pathname === "/"
    },
    {
      href: "/transcripts",
      label: "Transcripts",
      icon: FileText,
      active: pathname === "/transcripts"
    },
    {
      href: "/summaries",
      label: "Summaries",
      icon: FileText,
      active: pathname === "/summaries"
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      active: pathname === "/settings"
    }
  ];

  const NavItems = () => (
    <>
      {routes.map((route) => {
        const Icon = route.icon;
        return (
          <Link
            key={route.href}
            href={route.href}
            className={cn(
              "flex items-center text-sm font-medium transition-colors hover:text-primary",
              route.active 
                ? "text-primary" 
                : "text-muted-foreground"
            )}
            onClick={() => setIsOpen(false)}
          >
            <Icon className="h-4 w-4 mr-2" />
            {route.label}
          </Link>
        );
      })}
    </>
  );

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <nav className="flex items-center justify-between w-full">
      <div className="flex items-center space-x-4 lg:space-x-6">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] sm:w-[300px]">
            <DialogTitle className="sr-only">Navigation menu</DialogTitle>
            <div className="flex flex-col space-y-4 mt-6">
              <NavItems />
              <SheetClose asChild>
                <Button
                  variant="destructive"
                  onClick={handleSignOut}
                  className="w-full mt-4"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
        <div className="hidden md:flex md:items-center md:space-x-4 lg:space-x-6">
          <NavItems />
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <ModeToggle />
        <Button
          variant="destructive"
          onClick={handleSignOut}
          className="hidden md:inline-flex"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </nav>
  );
}

