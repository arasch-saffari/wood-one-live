"use client";
import React from 'react'
import { ConfigProvider } from "@/hooks/useConfig";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { EnablePwaBanner } from "@/components/enable-sound-banner";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider>
      <TooltipProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <EnablePwaBanner />
        </ThemeProvider>
      </TooltipProvider>
    </ConfigProvider>
  );
} 