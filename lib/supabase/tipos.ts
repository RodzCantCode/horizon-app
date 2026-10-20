// Generado: no se edita a mano. Tipos de las tablas de Supabase tal cual las da la base de datos
// (snake_case); las pantallas y lib/planes.ts usan los de lib/tipos.ts.
// Para regenerarlo después de cada migración: herramienta `generate_typescript_types` de la
// conexión `supabase-horizon` (desde Claude) y sustituir todo lo que hay debajo de este comentario.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      estrategia_piezas: {
        Row: {
          desplazamiento: number
          estrategia_id: string
          id: string
          pieza_id: string
        }
        Insert: {
          desplazamiento: number
          estrategia_id: string
          id?: string
          pieza_id: string
        }
        Update: {
          desplazamiento?: number
          estrategia_id?: string
          id?: string
          pieza_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estrategia_piezas_estrategia_id_fkey"
            columns: ["estrategia_id"]
            isOneToOne: false
            referencedRelation: "estrategias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estrategia_piezas_pieza_id_fkey"
            columns: ["pieza_id"]
            isOneToOne: false
            referencedRelation: "piezas"
            referencedColumns: ["id"]
          },
        ]
      }
      estrategias: {
        Row: {
          con_episodio: boolean
          id: string
          nombre: string
        }
        Insert: {
          con_episodio: boolean
          id?: string
          nombre: string
        }
        Update: {
          con_episodio?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          id: string
          nombre: string
        }
        Insert: {
          id: string
          nombre: string
        }
        Update: {
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      piezas: {
        Row: {
          archivada: boolean
          canales: string[]
          dias_permitidos: number[]
          dias_preparacion: number
          formato: string
          hora_habitual: string | null
          id: string
          nombre: string
          nombre_corto: string
        }
        Insert: {
          archivada?: boolean
          canales: string[]
          dias_permitidos: number[]
          dias_preparacion: number
          formato: string
          hora_habitual?: string | null
          id?: string
          nombre: string
          nombre_corto: string
        }
        Update: {
          archivada?: boolean
          canales?: string[]
          dias_permitidos?: number[]
          dias_preparacion?: number
          formato?: string
          hora_habitual?: string | null
          id?: string
          nombre?: string
          nombre_corto?: string
        }
        Relationships: []
      }
      plan_piezas: {
        Row: {
          canales: string[]
          desplazamiento: number
          dias_preparacion: number
          estado: string
          fecha: string
          formato: string
          hora: string | null
          id: string
          nombre: string
          nombre_corto: string
          pieza_id: string | null
          plan_id: string
          revisar: boolean
        }
        Insert: {
          canales: string[]
          desplazamiento: number
          dias_preparacion: number
          estado?: string
          fecha: string
          formato: string
          hora?: string | null
          id?: string
          nombre: string
          nombre_corto: string
          pieza_id?: string | null
          plan_id: string
          revisar?: boolean
        }
        Update: {
          canales?: string[]
          desplazamiento?: number
          dias_preparacion?: number
          estado?: string
          fecha?: string
          formato?: string
          hora?: string | null
          id?: string
          nombre?: string
          nombre_corto?: string
          pieza_id?: string | null
          plan_id?: string
          revisar?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plan_piezas_pieza_id_fkey"
            columns: ["pieza_id"]
            isOneToOne: false
            referencedRelation: "piezas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_piezas_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
        ]
      }
      planes: {
        Row: {
          con_episodio: boolean
          dia_d: string
          estrategia_id: string | null
          estrategia_nombre: string
          hora_episodio: string | null
          id: string
          invitado: string | null
          lunes: string
          numero: string | null
          tema: string | null
        }
        Insert: {
          con_episodio: boolean
          dia_d: string
          estrategia_id?: string | null
          estrategia_nombre: string
          hora_episodio?: string | null
          id?: string
          invitado?: string | null
          lunes: string
          numero?: string | null
          tema?: string | null
        }
        Update: {
          con_episodio?: boolean
          dia_d?: string
          estrategia_id?: string | null
          estrategia_nombre?: string
          hora_episodio?: string | null
          id?: string
          invitado?: string | null
          lunes?: string
          numero?: string | null
          tema?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planes_estrategia_id_fkey"
            columns: ["estrategia_id"]
            isOneToOne: false
            referencedRelation: "estrategias"
            referencedColumns: ["id"]
          },
        ]
      }
      registro: {
        Row: {
          accion: string
          creado_en: string
          detalle: Json | null
          fila_id: string
          id: string
          tabla: string
          usuario_id: string | null
        }
        Insert: {
          accion: string
          creado_en?: string
          detalle?: Json | null
          fila_id: string
          id?: string
          tabla: string
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          creado_en?: string
          detalle?: Json | null
          fila_id?: string
          id?: string
          tabla?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cambiar_estrategia: {
        Args: {
          estrategia_id: string
          estrategia_nombre: string
          piezas: Json
          plan_id: string
        }
        Returns: undefined
      }
      crear_plan: { Args: { piezas: Json; plan: Json }; Returns: string }
      mover_episodio: {
        Args: { nuevo_dia_d: string; plan_id: string }
        Returns: undefined
      }
      mover_plan: {
        Args: { nuevo_dia_d: string; plan_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
