import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlowButton } from "@/components/ui/glow-button";
import { GradientText } from "@/components/ui/gradient-text";
import { useToast } from "@/hooks/use-toast";
import { Phone } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const callFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: z.string().min(10, "Valid phone number is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type CallFormData = z.infer<typeof callFormSchema>;

export function CallForm() {
  const { toast } = useToast();
  
  const form = useForm<CallFormData>({
    resolver: zodResolver(callFormSchema),
    defaultValues: {
      name: "",
      phoneNumber: "",
      message: "",
    },
  });

  // ARAS AI Smart Call - Gemini + ElevenLabs Integration
  const initiateCall = useMutation({
    mutationFn: async (callData: CallFormData) => {
      const response = await apiRequest("POST", "/api/aras-voice/smart-call", {
        name: callData.name,
        phoneNumber: callData.phoneNumber,
        message: callData.message
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "🎯 ARAS AI ruft an!",
        description: data.message || `Anruf an ${form.getValues('name')} wird getätigt...`,
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Anruf fehlgeschlagen",
        description: error.message || "Bitte versuche es erneut",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: CallFormData) => {
    await initiateCall.mutateAsync(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <GradientText>Manual Call</GradientText>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kontaktname (wen rufst du an?)</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Restaurant Bella Italia" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefonnummer</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="+49 176 611 19320" 
                      type="tel"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Was soll ARAS AI sagen?</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="z.B. Verschiebe mein Abendessen auf morgen 18:00 Uhr"
                      className="resize-none"
                      rows={4}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <GlowButton
              type="submit"
              className="w-full"
              disabled={initiateCall.isPending}
            >
              <Phone className="w-4 h-4 mr-2" />
              {initiateCall.isPending ? "ARAS AI ruft an..." : "Jetzt anrufen"}
            </GlowButton>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
