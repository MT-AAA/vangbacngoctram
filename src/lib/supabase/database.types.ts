export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          store_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          store_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          store_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classification_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          priority: number
          store_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          priority?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          priority?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_purchases: {
        Row: {
          becomes_inventory: boolean
          created_at: string
          created_by: string | null
          customer_id_card: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          inventory_item_id: string | null
          notes: string | null
          product_category_id: string | null
          product_name: string
          purchase_date: string
          quantity: number
          store_id: string
          total_amount: number
          unit_price: number
          updated_at: string
          weight: number | null
          weight_unit: string
        }
        Insert: {
          becomes_inventory?: boolean
          created_at?: string
          created_by?: string | null
          customer_id_card?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          product_category_id?: string | null
          product_name: string
          purchase_date: string
          quantity?: number
          store_id: string
          total_amount?: number
          unit_price?: number
          updated_at?: string
          weight?: number | null
          weight_unit?: string
        }
        Update: {
          becomes_inventory?: boolean
          created_at?: string
          created_by?: string | null
          customer_id_card?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          product_category_id?: string | null
          product_name?: string
          purchase_date?: string
          quantity?: number
          store_id?: string
          total_amount?: number
          unit_price?: number
          updated_at?: string
          weight?: number | null
          weight_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_purchases_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_purchases_product_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_purchases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      import_files: {
        Row: {
          created_at: string
          error_log: Json | null
          error_rows: number
          file_name: string
          id: string
          inserted_rows: number
          notes: string | null
          period_end: string | null
          period_start: string | null
          processed_at: string | null
          status: Database["public"]["Enums"]["import_status"]
          storage_path: string | null
          store_id: string
          total_amount: number
          total_rows: number
          transaction_line_count: number
          unique_invoice_count: number
          updated_rows: number
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          error_log?: Json | null
          error_rows?: number
          file_name: string
          id?: string
          inserted_rows?: number
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          store_id: string
          total_amount?: number
          total_rows?: number
          transaction_line_count?: number
          unique_invoice_count?: number
          updated_rows?: number
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          error_log?: Json | null
          error_rows?: number
          file_name?: string
          id?: string
          inserted_rows?: number
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          store_id?: string
          total_amount?: number
          total_rows?: number
          transaction_line_count?: number
          unique_invoice_count?: number
          updated_rows?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_files_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          product_category_id: string | null
          quantity_on_hand: number
          sku: string | null
          source_customer_purchase_id: string | null
          status: Database["public"]["Enums"]["inventory_status"]
          store_id: string
          total_cost: number
          unit_cost: number
          updated_at: string
          weight: number | null
          weight_unit: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          product_category_id?: string | null
          quantity_on_hand?: number
          sku?: string | null
          source_customer_purchase_id?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          store_id: string
          total_cost?: number
          unit_cost?: number
          updated_at?: string
          weight?: number | null
          weight_unit?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          product_category_id?: string | null
          quantity_on_hand?: number
          sku?: string | null
          source_customer_purchase_id?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          store_id?: string
          total_cost?: number
          unit_cost?: number
          updated_at?: string
          weight?: number | null
          weight_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_product_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_source_customer_purchase_fkey"
            columns: ["source_customer_purchase_id"]
            isOneToOne: false
            referencedRelation: "customer_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          store_id: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          store_id: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_transactions: {
        Row: {
          classification_source: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          currency_rate: number | null
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_tax_code: string | null
          id: string
          ignored_at: string | null
          ignored_by: string | null
          ignored_reason: string | null
          import_file_id: string | null
          invoice_date: string | null
          invoice_key: string | null
          invoice_no: string | null
          invoice_series: string | null
          invoice_status: string | null
          invoice_template_code: string | null
          is_intentionally_ignored: boolean
          linked_inventory_item_id: string | null
          notes: string | null
          payment_method: string | null
          payment_status: string | null
          product_category_id: string | null
          product_code: string | null
          product_name: string | null
          product_name_raw: string
          purchase_cost_amount: number | null
          purchase_cost_source: Database["public"]["Enums"]["purchase_cost_source"]
          quantity: number
          raw_data: Json | null
          sale_date: string
          sales_amount_before_tax: number | null
          source_row_number: number | null
          source_stt: number | null
          store_id: string
          tax_authority_code: string | null
          tax_authority_status: string | null
          tax_calculation_status: Database["public"]["Enums"]["tax_calc_status"]
          total_amount: number
          transaction_hash: string
          unit: string | null
          unit_price: number
          updated_at: string
          value_added_amount: number | null
          vat_output_amount_from_invoice: number | null
          weight: number | null
          weight_unit: string | null
        }
        Insert: {
          classification_source?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          currency_rate?: number | null
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_tax_code?: string | null
          id?: string
          ignored_at?: string | null
          ignored_by?: string | null
          ignored_reason?: string | null
          import_file_id?: string | null
          invoice_date?: string | null
          invoice_key?: string | null
          invoice_no?: string | null
          invoice_series?: string | null
          invoice_status?: string | null
          invoice_template_code?: string | null
          is_intentionally_ignored?: boolean
          linked_inventory_item_id?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          product_category_id?: string | null
          product_code?: string | null
          product_name?: string | null
          product_name_raw: string
          purchase_cost_amount?: number | null
          purchase_cost_source?: Database["public"]["Enums"]["purchase_cost_source"]
          quantity?: number
          raw_data?: Json | null
          sale_date: string
          sales_amount_before_tax?: number | null
          source_row_number?: number | null
          source_stt?: number | null
          store_id: string
          tax_authority_code?: string | null
          tax_authority_status?: string | null
          tax_calculation_status?: Database["public"]["Enums"]["tax_calc_status"]
          total_amount?: number
          transaction_hash: string
          unit?: string | null
          unit_price?: number
          updated_at?: string
          value_added_amount?: number | null
          vat_output_amount_from_invoice?: number | null
          weight?: number | null
          weight_unit?: string | null
        }
        Update: {
          classification_source?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          currency_rate?: number | null
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_tax_code?: string | null
          id?: string
          ignored_at?: string | null
          ignored_by?: string | null
          ignored_reason?: string | null
          import_file_id?: string | null
          invoice_date?: string | null
          invoice_key?: string | null
          invoice_no?: string | null
          invoice_series?: string | null
          invoice_status?: string | null
          invoice_template_code?: string | null
          is_intentionally_ignored?: boolean
          linked_inventory_item_id?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          product_category_id?: string | null
          product_code?: string | null
          product_name?: string | null
          product_name_raw?: string
          purchase_cost_amount?: number | null
          purchase_cost_source?: Database["public"]["Enums"]["purchase_cost_source"]
          quantity?: number
          raw_data?: Json | null
          sale_date?: string
          sales_amount_before_tax?: number | null
          source_row_number?: number | null
          source_stt?: number | null
          store_id?: string
          tax_authority_code?: string | null
          tax_authority_status?: string | null
          tax_calculation_status?: Database["public"]["Enums"]["tax_calc_status"]
          total_amount?: number
          transaction_hash?: string
          unit?: string | null
          unit_price?: number
          updated_at?: string
          value_added_amount?: number | null
          vat_output_amount_from_invoice?: number | null
          weight?: number | null
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_transactions_ignored_by_fkey"
            columns: ["ignored_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_transactions_import_file_id_fkey"
            columns: ["import_file_id"]
            isOneToOne: false
            referencedRelation: "import_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_transactions_linked_inventory_item_id_fkey"
            columns: ["linked_inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_transactions_product_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          tax_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          tax_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          tax_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tax_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_locked: boolean
          name: string
          notes: string | null
          period_type: Database["public"]["Enums"]["tax_period_type"]
          start_date: string
          store_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_locked?: boolean
          name: string
          notes?: string | null
          period_type: Database["public"]["Enums"]["tax_period_type"]
          start_date: string
          store_id: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_locked?: boolean
          name?: string
          notes?: string | null
          period_type?: Database["public"]["Enums"]["tax_period_type"]
          start_date?: string
          store_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_periods_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_reports: {
        Row: {
          calculated_at: string
          calculated_by: string | null
          id: string
          negative_carried_in: number
          negative_carried_out: number
          notes: string | null
          store_id: string
          tax_period_id: string
          taxable_value_added: number
          total_purchase_cost_amount: number
          total_sales_amount: number
          total_transactions: number
          transactions_estimated: number
          transactions_missing_purchase_cost: number
          value_added_amount: number
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          calculated_at?: string
          calculated_by?: string | null
          id?: string
          negative_carried_in?: number
          negative_carried_out?: number
          notes?: string | null
          store_id: string
          tax_period_id: string
          taxable_value_added?: number
          total_purchase_cost_amount?: number
          total_sales_amount?: number
          total_transactions?: number
          transactions_estimated?: number
          transactions_missing_purchase_cost?: number
          value_added_amount?: number
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          calculated_at?: string
          calculated_by?: string | null
          id?: string
          negative_carried_in?: number
          negative_carried_out?: number
          notes?: string | null
          store_id?: string
          tax_period_id?: string
          taxable_value_added?: number
          total_purchase_cost_amount?: number
          total_sales_amount?: number
          total_transactions?: number
          transactions_estimated?: number
          transactions_missing_purchase_cost?: number
          value_added_amount?: number
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_reports_calculated_by_fkey"
            columns: ["calculated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_reports_tax_period_id_fkey"
            columns: ["tax_period_id"]
            isOneToOne: false
            referencedRelation: "tax_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_settings: {
        Row: {
          created_at: string
          id: string
          method: string
          notes: string | null
          store_id: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          store_id: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          store_id?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_store_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      seed_store_defaults: { Args: { p_store_id: string }; Returns: undefined }
    }
    Enums: {
      import_status: "uploaded" | "processing" | "completed" | "failed"
      inventory_status: "in_stock" | "sold" | "reserved" | "written_off"
      purchase_cost_source:
        | "excel"
        | "manual"
        | "inventory"
        | "average"
        | "unknown"
      tax_calc_status:
        | "complete"
        | "missing_purchase_cost"
        | "estimated"
        | "ignored"
      tax_period_type: "month" | "quarter" | "year" | "custom"
      user_role: "admin" | "staff" | "viewer"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      import_status: ["uploaded", "processing", "completed", "failed"],
      inventory_status: ["in_stock", "sold", "reserved", "written_off"],
      purchase_cost_source: [
        "excel",
        "manual",
        "inventory",
        "average",
        "unknown",
      ],
      tax_calc_status: ["complete", "missing_purchase_cost", "estimated", "ignored"],
      tax_period_type: ["month", "quarter", "year", "custom"],
      user_role: ["admin", "staff", "viewer"],
    },
  },
} as const

