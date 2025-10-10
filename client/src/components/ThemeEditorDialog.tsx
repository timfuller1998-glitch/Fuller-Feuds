import { useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { hexToHSL, generatePalette, getThemeType, formatHSL } from "@shared/colorUtils";
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

export function ThemeEditorDialog({ open, onOpenChange, editingTheme }: ThemeEditorDialogProps) {
  const { toast } = useToast();
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [previewColors, setPreviewColors] = useState<any>(null);

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
      form.reset({
        name: "",
        description: "",
        visibility: "private",
        backgroundColor: "#ffffff",
      });
    }
  }, [editingTheme, open, form]);

  // Update preview when background color changes
  useEffect(() => {
    try {
      const bgHSL = hexToHSL(backgroundColor);
      const palette = generatePalette(bgHSL);
      setPreviewColors(palette);
      form.setValue("backgroundColor", backgroundColor);
    } catch (error) {
      console.error("Error generating palette:", error);
    }
  }, [backgroundColor, form]);

  // Save theme mutation
  const saveThemeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof themeFormSchema>) => {
      const bgHSL = hexToHSL(data.backgroundColor);
      const palette = generatePalette(bgHSL);
      const baseTheme = getThemeType(bgHSL);

      const themeData = {
        name: data.name,
        description: data.description || null,
        visibility: data.visibility,
        baseTheme,
        colors: palette,
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-theme-editor-title">
            {editingTheme ? "Edit Theme" : "Create New Theme"}
          </DialogTitle>
          <DialogDescription>
            {editingTheme 
              ? "Update your custom theme settings and colors." 
              : "Create a custom color theme by selecting a background color."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column - Form fields */}
              <div className="space-y-4">
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

                {/* Color Picker */}
                <div className="space-y-2">
                  <FormLabel>Background Color</FormLabel>
                  <div className="flex items-center gap-4">
                    <HexColorPicker
                      color={backgroundColor}
                      onChange={setBackgroundColor}
                      style={{ width: "100%", height: "150px" }}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
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
                  </div>
                  {previewColors && (
                    <p className="text-sm text-muted-foreground">
                      Base Theme: <span className="font-semibold capitalize">{getThemeType(hexToHSL(backgroundColor))}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Right column - Color palette preview */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-3">Color Palette Preview</h4>
                  {previewColors && (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(previewColors).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-md border"
                            style={{
                              backgroundColor: `hsl(${value.h}, ${value.s}%, ${value.l}%)`,
                            }}
                            data-testid={`color-swatch-${key}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {formatHSL(value)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

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
