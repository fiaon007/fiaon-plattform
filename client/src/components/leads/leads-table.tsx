import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientText } from "@/components/ui/gradient-text";
import { useToast } from "@/hooks/use-toast";
import { Eye, Phone, Mail, Filter, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

export function LeadsTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Use demo data for prototype
  const leads = [
    {
      id: 1,
      name: "Sarah Johnson",
      email: "sarah.johnson@techcorp.com",
      phone: "+1 (555) 123-4567",
      company: "TechCorp Industries",
      status: "hot",
      notes: "Interested in enterprise package, decision maker",
      createdAt: new Date("2024-12-15"),
      updatedAt: new Date("2024-12-20")
    },
    {
      id: 2,
      name: "Michael Chen",
      email: "m.chen@innovateai.com",
      phone: "+1 (555) 987-6543",
      company: "InnovateAI Solutions",
      status: "warm",
      notes: "Evaluating options, budget confirmed",
      createdAt: new Date("2024-12-18"),
      updatedAt: new Date("2024-12-21")
    },
    {
      id: 3,
      name: "Emily Rodriguez",
      email: "emily.r@datastream.io",
      phone: "+1 (555) 456-7890",
      company: "DataStream Analytics",
      status: "cold",
      notes: "Initial contact made, needs follow-up",
      createdAt: new Date("2024-12-10"),
      updatedAt: new Date("2024-12-19")
    }
  ];
  const isLoading = false;

  // Demo function for lead deletion
  const handleDeleteLead = (leadId: number) => {
    toast({
      title: "Lead Deleted",
      description: "Lead has been successfully deleted.",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "hot":
        return "bg-green-500/20 text-green-400";
      case "warm":
        return "bg-yellow-500/20 text-yellow-400";
      case "cold":
        return "bg-gray-500/20 text-gray-400";
      case "contacted":
        return "bg-blue-500/20 text-blue-400";
      case "converted":
        return "bg-purple-500/20 text-purple-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredLeads = leads.filter((lead: any) =>
    lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <GradientText>Leads</GradientText>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            <GradientText>Recent Leads</GradientText>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
            <Button size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Contact</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead: any, index: number) => (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="border-b border-border hover:bg-secondary/50 transition-colors"
                >
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(lead.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{lead.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {lead.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{lead.company || "N/A"}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(lead.status)}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {lead.lastContact
                      ? new Date(lead.lastContact).toLocaleDateString()
                      : "Never"
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Mail className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteLead(lead.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
