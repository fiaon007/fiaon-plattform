import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlowButton } from "@/components/ui/glow-button";
import { GradientText } from "@/components/ui/gradient-text";
import { useToast } from "@/hooks/use-toast";
import { CloudUpload, Upload } from "lucide-react";
import { motion } from "framer-motion";

export function CSVUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const csvFile = acceptedFiles[0];
    if (csvFile) {
      setFile(csvFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    
    // Simulate upload process
    setTimeout(() => {
      toast({
        title: "Upload Successful",
        description: `${file.name} has been uploaded successfully.`,
      });
      setFile(null);
      setIsUploading(false);
    }, 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <GradientText>Bulk Upload</GradientText>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            isDragActive
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50"
          }`}
        >
          <input {...getInputProps()} />
          <CloudUpload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          
          {file ? (
            <div>
              <p className="text-foreground mb-2">File selected:</p>
              <p className="text-sm text-muted-foreground font-medium">{file.name}</p>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground mb-2">
                {isDragActive
                  ? "Drop your CSV file here"
                  : "Drag and drop your CSV file here"
                }
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
            </div>
          )}
        </div>
        
        <div className="mt-4">
          <GlowButton
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload Leads"}
          </GlowButton>
        </div>
      </CardContent>
    </Card>
  );
}
