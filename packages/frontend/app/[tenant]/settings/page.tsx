'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and workspace settings.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Settings</CardTitle>
              <CardDescription>Manage your workspace information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input id="workspace-name" defaultValue="My Workspace" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace-slug">Workspace Slug</Label>
                <Input id="workspace-slug" defaultValue="my-workspace" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace-email">Contact Email</Label>
                <Input id="workspace-email" type="email" defaultValue="contact@example.com" />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Integration</CardTitle>
              <CardDescription>Configure your WhatsApp Business API settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wa-phone">WhatsApp Business Number</Label>
                <Input id="wa-phone" placeholder="+1234567890" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa-api-key">API Key</Label>
                <Input id="wa-api-key" type="password" placeholder="Enter your API key" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa-webhook">Webhook URL</Label>
                <Input id="wa-webhook" defaultValue="https://api.example.com/webhook/whatsapp" />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-reply Enabled</Label>
                  <p className="text-sm text-muted-foreground">Automatically reply to incoming messages</p>
                </div>
                <Switch />
              </div>
              <Button>Save Configuration</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing & Plans</CardTitle>
              <CardDescription>Manage your subscription and payment methods</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Pro Plan</h3>
                    <p className="text-sm text-muted-foreground">$49/month • Renews on Jan 15, 2026</p>
                  </div>
                  <Badge>Active</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Messages</span>
                    <span className="text-muted-foreground">2,847 / 10,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Team Members</span>
                    <span className="text-muted-foreground">5 / 10</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">Upgrade Plan</Button>
                <Button variant="outline">Manage Payment Methods</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage access and permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button>Invite Member</Button>
              {/* Team members list would go here */}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
