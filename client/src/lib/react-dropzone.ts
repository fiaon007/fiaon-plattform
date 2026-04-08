// Mock implementation for react-dropzone since it's not in package.json
import React from 'react';

export function useDropzone(options: any) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  
  const getRootProps = () => ({
    onClick: () => inputRef.current?.click(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (options.onDrop) {
        options.onDrop(files);
      }
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
  });
  
  const getInputProps = () => ({
    ref: inputRef,
    type: 'file',
    accept: options.accept ? Object.keys(options.accept).join(',') : undefined,
    multiple: options.maxFiles !== 1,
    style: { display: 'none' },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (options.onDrop) {
        options.onDrop(files);
      }
    },
  });
  
  return {
    getRootProps,
    getInputProps,
    isDragActive: false,
  };
}
