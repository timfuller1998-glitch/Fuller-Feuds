import { useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { hexToHSL, generatePaletteVariations, getThemeType, formatHSL, type ThemeColors } from "@shared/colorUtils";
import type { Theme } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { MessageSquare, Users } from "lucide-react";

const themeFormSchema = z.object({
  name: z.string().min(1, "Theme name is required").max(100, "Theme name must be 100 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  visibility: z.enum(["public", "private"]),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color"),
});

interface ThemeEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTheme?: Theme | null;
}

// ThemePreview component - shows a miniature version of debate platform UI
function ThemePreview({ colors }: { colors: ThemeColors }) {
  const bg = `hsl(${formatHSL(colors.background)})`;
  const fg = `hsl(${formatHSL(colors.foreground)})`;
  const cardBg = `hsl(${formatHSL(colors.card)})`;
  const cardFg = `hsl(${formatHSL(colors.cardForeground)})`;
  const primary = `hsl(${formatHSL(colors.primary)})`;
  const primaryFg = `hsl(${formatHSL(colors.primaryForeground)})`;
  const muted = `hsl(${formatHSL(colors.muted)})`;
  const mutedFg = `hsl(${formatHSL(colors.mutedForeground)})`;
  const border = `hsl(${formatHSL(colors.border)})`;

  return (
    <div
      className="w-full h-full rounded-lg overflow-hidden border-2"
      style={{
        backgroundColor: bg,
        borderColor: border,
      }}
      data-testid="theme-preview"
    >
      {/* Navigation bar */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          borderBottom: `1px solid ${border}`,
        }}
      >
        <span
          className="font-bold text-sm"
          style={{ color: fg }}
        >
          Kirk Debates
        </span>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 text-xs rounded-md font-medium"
            style={{
              backgroundColor: primary,
              color: primaryFg,
            }}
          >
            Sign In
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="p-4 space-y-3">
        {/* Debate topic card */}
        <div
          className="rounded-lg p-4 border"
          style={{
            backgroundColor: cardBg,
            borderColor: border,
          }}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3
              className="font-semibold text-sm line-clamp-1"
              style={{ color: cardFg }}
            >
              Should AI have rights in society?
            </h3>
          </div>
          <p
            className="text-xs line-clamp-2 mb-3"
            style={{ color: mutedFg }}
          >
            Exploring the ethical implications of artificial intelligence and whether AI systems deserve legal protections and rights.
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs" style={{ color: mutedFg }}>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                142
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                89
              </span>
            </div>
            <button
              className="px-3 py-1 text-xs rounded-md font-medium"
              style={{
                backgroundColor: primary,
                color: primaryFg,
              }}
            >
              Join Debate
            </button>
          </div>
        </div>

        {/* Secondary card */}
        <div
          className="rounded-lg p-4 border"
          style={{
            backgroundColor: cardBg,
            borderColor: border,
          }}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3
              className="font-semibold text-sm line-clamp-1"
              style={{ color: cardFg }}
            >
              Climate action vs economic growth
            </h3>
          </div>
          <p
            className="text-xs line-clamp-2 mb-3"
            style={{ color: mutedFg }}
          >
            Can we balance environmental protection with economic development?
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs" style={{ color: mutedFg }}>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                203
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                156
              </span>
            </div>
            <button
              className="px-3 py-1 text-xs rounded-md font-medium"
              style={{
                backgroundColor: muted,
                color: fg,
              }}
            >
              View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThemeEditorDialog({ open, onOpenChange, editingTheme }: ThemeEditorDialogProps) {
  const { toast } = useToast();
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [paletteVariations, setPaletteVariations] = useState<ThemeColors[]>([]);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();

  const form = useForm<z.infer<typeof themeFormSchema>>({
    resolver: zodResolver(themeFormSchema),
    defaultValues: {
      name: "",
      description: "",
      visibility: "private",
      backgroundColor: "#ffffff",
    },
  });

  // Update form when editing theme changes
  useEffect(() => {
    if (editingTheme && open) {
      const colors = editingTheme.colors as any;
      const bgColor = colors.background;
      
      // Convert HSL to hex for the color picker (approximate)
      const hex = hslToHex(bgColor.h, bgColor.s, bgColor.l);
      
      setBackgroundColor(hex);
      form.reset({
        name: editingTheme.name,
        description: editingTheme.description || "",
        visibility: editingTheme.visibility as "public" | "private",
        backgroundColor: hex,
      });
    } else if (!editingTheme && open) {
      // Reset for create mode
      setBackgroundColor("#ffffff");
      setSelectedVariationIndex(0);
      form.reset({
        name: "",
        description: "",
        visibility: "private",
        backgroundColor: "#ffffff",
      });
    }
  }, [editingTheme, open, form]);

  // Update palette variations when background color changes
  useEffect(() => {
    try {
      const bgHSL = hexToHSL(backgroundColor);
      const variations = generatePaletteVariations(bgHSL);
      setPaletteVariations(variations);
      form.setValue("backgroundColor", backgroundColor);
    } catch (error) {
      console.error("Error generating palette variations:", error);
    }
  }, [backgroundColor, form]);

  // Track carousel selection changes
  useEffect(() => {
    if (!carouselApi) return;

    const onSelect = () => {
      setSelectedVariationIndex(carouselApi.selectedScrollSnap());
    };

    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  // Save theme mutation
  const saveThemeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof themeFormSchema>) => {
      const bgHSL = hexToHSL(data.backgroundColor);
      const variations = generatePaletteVariations(bgHSL);
      const selectedPalette = variations[selectedVariationIndex];
      const baseTheme = getThemeType(selectedPalette.background);

      const themeData = {
        name: data.name,
        description: data.description || null,
        visibility: data.visibility,
        baseTheme,
        colors: selectedPalette,
      };

      if (editingTheme) {
        return apiRequest('PATCH', `/api/themes/${editingTheme.id}`, themeData);
      } else {
        return apiRequest('POST', '/api/themes', themeData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/themes/my-themes'] });
      toast({
        title: editingTheme ? "Theme updated" : "Theme created",
        description: editingTheme 
          ? "Your theme has been updated successfully." 
          : "Your theme has been created successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save theme",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof themeFormSchema>) => {
    saveThemeMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-theme-editor-title">
            {editingTheme ? "Edit Theme" : "Create New Theme"}
          </DialogTitle>
          <DialogDescription>
            {editingTheme 
              ? "Update your custom theme settings and colors." 
              : "Create a custom color theme by selecting a background color. Swipe to explore 5 color variations."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Color Picker Section */}
            <div className="space-y-2">
              <FormLabel>Background Color</FormLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <HexColorPicker
                    color={backgroundColor}
                    onChange={setBackgroundColor}
                    style={{ width: "100%", height: "150px" }}
                  />
                  <Input
                    value={backgroundColor}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                        setBackgroundColor(value);
                      }
                    }}
                    placeholder="#ffffff"
                    className="font-mono"
                    data-testid="input-background-color"
                  />
                  {paletteVariations.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Variation {selectedVariationIndex + 1} of 5 • Base Theme: <span className="font-semibold capitalize">{getThemeType(paletteVariations[selectedVariationIndex].background)}</span>
                    </p>
                  )}
                </div>

                {/* Carousel with 5 Preview Slides */}
                <div className="relative">
                  {paletteVariations.length > 0 && (
                    <Carousel
                      setApi={setCarouselApi}
                      className="w-full"
                      opts={{ loop: true }}
                    >
                      <CarouselContent>
                        {paletteVariations.map((variation, index) => (
                          <CarouselItem key={index}>
                            <div className="h-[200px]">
                              <ThemePreview colors={variation} />
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <CarouselPrevious 
                        className="left-2"
                        data-testid="button-carousel-prev"
                      />
                      <CarouselNext 
                        className="right-2"
                        data-testid="button-carousel-next"
                      />
                    </Carousel>
                  )}
                  
                  {/* Carousel indicators */}
                  <div className="flex items-center justify-center gap-2 mt-3">
                    {paletteVariations.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => carouselApi?.scrollTo(index)}
                        className="transition-all"
                        data-testid={`button-variation-${index}`}
                        aria-label={`Select variation ${index + 1}`}
                      >
                        <div
                          className={`rounded-full transition-all ${
                            selectedVariationIndex === index
                              ? "w-2 h-2 bg-primary"
                              : "w-1.5 h-1.5 bg-muted-foreground/30"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Theme Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="My Awesome Theme"
                        data-testid="input-theme-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your theme..."
                        className="resize-none min-h-[80px]"
                        data-testid="input-theme-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Public Theme</FormLabel>
                    <FormDescription>
                      Make this theme visible to other users
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value === "public"}
                      onCheckedChange={(checked) => field.onChange(checked ? "public" : "private")}
                      data-testid="switch-theme-visibility"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-theme"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveThemeMutation.isPending}
                data-testid="button-save-theme"
              >
                {saveThemeMutation.isPending ? "Saving..." : editingTheme ? "Update Theme" : "Create Theme"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to convert HSL to hex (approximate)
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
