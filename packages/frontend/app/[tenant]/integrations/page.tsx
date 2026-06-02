'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSpreadsheet, Loader2, Upload, Sheet, Trash2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface DataSource {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  category: string;
  createdAt: string;
  metadata?: {
    knowledgeBase?: any;
  };
}

interface GoogleSheetConnection {
  id: string;
  title: string;
  spreadsheetId: string;
  connectedAt: string;
  updatedAt: string;
}

export default function IntegrationsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;

  const [isLoading, setIsLoading] = useState(true);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [googleSheets, setGoogleSheets] = useState<GoogleSheetConnection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIntegrations() {
      setIsLoading(true);
      setError(null);

      try {
        const token = storage.getItem<string>('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const [sources, sheets] = await Promise.all([
          api.get<{ data: DataSource[] }>('/integrations/data-sources', token).catch(() => ({ data: [] })),
          api.get<{ data: GoogleSheetConnection[] }>('/integrations/google-sheets', token).catch(() => ({ data: [] })),
        ]);

        setDataSources(sources.data || []);
        setGoogleSheets(sheets.data || []);

      } catch (err: any) {
        console.error('Error fetching integrations:', err);
        setError(err.message || 'Failed to load integrations');
      } finally {
        setIsLoading(false);
      }
    }

    if (tenantSlug) {
      fetchIntegrations();
    }
  }, [tenantSlug, router]);

  const generateKnowledgeBase = async (sourceId: string) => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.post(`/integrations/data-sources/${sourceId}/knowledge-base`, {}, token);
      alert('Knowledge base generada exitosamente');

    } catch (err: any) {
      console.error('Error generating knowledge base:', err);
      alert('Error al generar knowledge base');
    }
  };

  const deleteDataSource = async (sourceId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta fuente de datos?')) return;

    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.delete(`/integrations/data-sources/${sourceId}`, token);
      setDataSources(dataSources.filter(s => s.id !== sourceId));

    } catch (err: any) {
      console.error('Error deleting data source:', err);
      alert('Error al eliminar fuente de datos');
    }
  };

  const disconnectGoogleSheet = async (spreadsheetId: string) => {
    if (!confirm('¿Estás seguro de desconectar esta hoja de Google?')) return;

    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.delete(`/integrations/google-sheets/${spreadsheetId}`, token);
      setGoogleSheets(googleSheets.filter(s => s.spreadsheetId !== spreadsheetId));

    } catch (err: any) {
      console.error('Error disconnecting Google Sheet:', err);
      alert('Error al desconectar Google Sheet');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integraciones</h1>
        <p className="text-muted-foreground">
          Conecta fuentes de datos para alimentar a tus agentes
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          Error: {error}
        </div>
      )}

      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">
            <Upload className="mr-2 h-4 w-4" />
            Archivos
          </TabsTrigger>
          <TabsTrigger value="sheets">
            <Sheet className="mr-2 h-4 w-4" />
            Google Sheets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Fuentes de Datos</CardTitle>
              <CardDescription>
                Archivos Excel y CSV subidos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dataSources.length === 0 ? (
                <div className="text-center py-12">
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No hay archivos</h3>
                  <p className="mt-2 text-muted-foreground">
                    Sube un archivo Excel o CSV para crear una base de conocimiento
                  </p>
                  <Button className="mt-4" asChild>
                    <a href={`/${tenantSlug}/integrations/upload`}>
                      <Upload className="mr-2 h-4 w-4" />
                      Subir Archivo
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {dataSources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-8 w-8 text-green-500" />
                        <div>
                          <div className="font-medium">{source.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {source.mimeType} • {new Date(source.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateKnowledgeBase(source.id)}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Generar KB
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteDataSource(source.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sheets" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Google Sheets</CardTitle>
              <CardDescription>
                Hojas de cálculo conectadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {googleSheets.length === 0 ? (
                <div className="text-center py-12">
                  <Sheet className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No hay conexiones</h3>
                  <p className="mt-2 text-muted-foreground">
                    Conecta una hoja de Google Sheets para usarla como base de conocimiento
                  </p>
                  <Button className="mt-4" asChild>
                    <a href={`/${tenantSlug}/integrations/google-sheets/connect`}>
                      <Sheet className="mr-2 h-4 w-4" />
                      Conectar Google Sheet
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {googleSheets.map((sheet) => (
                    <div key={sheet.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Sheet className="h-8 w-8 text-blue-500" />
                        <div>
                          <div className="font-medium">{sheet.title}</div>
                          <div className="text-sm text-muted-foreground">
                            Conectado: {new Date(sheet.connectedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a href={`/${tenantSlug}/integrations/google-sheets/${sheet.spreadsheetId}`}>
                            Ver datos
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => disconnectGoogleSheet(sheet.spreadsheetId)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
