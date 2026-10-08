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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      agent_accounts: {
        Row: {
          agent_email: string
          agent_id: string | null
          agent_org_id: string | null
          agent_type: number
          created_at: string
          deleted_at: string | null
          device_id: string | null
          id: string
          last_active_at: string | null
          last_seen_at: string
          metadata: Json | null
          models_configuration: Json | null
          org_id: string
          plan: number
          sandbox_id: string | null
          security_settings: Json | null
          tier: string | null
          updated_at: string
        }
        Insert: {
          agent_email: string
          agent_id?: string | null
          agent_org_id?: string | null
          agent_type: number
          created_at?: string
          deleted_at?: string | null
          device_id?: string | null
          id?: string
          last_active_at?: string | null
          last_seen_at?: string
          metadata?: Json | null
          models_configuration?: Json | null
          org_id: string
          plan: number
          sandbox_id?: string | null
          security_settings?: Json | null
          tier?: string | null
          updated_at?: string
        }
        Update: {
          agent_email?: string
          agent_id?: string | null
          agent_org_id?: string | null
          agent_type?: number
          created_at?: string
          deleted_at?: string | null
          device_id?: string | null
          id?: string
          last_active_at?: string | null
          last_seen_at?: string
          metadata?: Json | null
          models_configuration?: Json | null
          org_id?: string
          plan?: number
          sandbox_id?: string | null
          security_settings?: Json | null
          tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_accounts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "active_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "mcp_connected_agents_summary"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_accounts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_with_agents"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_baseline_scores: {
        Row: {
          agent_type: number
          applicable_to: number
          created_at: string
          id: string
          metadata: Json | null
          plan: number
          rationale: string | null
          risk_rule_id: string
          score: number | null
          updated_at: string
        }
        Insert: {
          agent_type: number
          applicable_to?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          plan: number
          rationale?: string | null
          risk_rule_id: string
          score?: number | null
          updated_at?: string
        }
        Update: {
          agent_type?: number
          applicable_to?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          plan?: number
          rationale?: string | null
          risk_rule_id?: string
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_baseline_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_baseline_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_baseline_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_baseline_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_baseline_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_catalog: {
        Row: {
          agent_name: string
          agent_type: number
          created_at: string
          description: string | null
          domain: string
          hosts: string[]
          id: string
          logo_url: string | null
          origin_country: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          agent_name: string
          agent_type: number
          created_at?: string
          description?: string | null
          domain: string
          hosts?: string[]
          id?: string
          logo_url?: string | null
          origin_country?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          agent_name?: string
          agent_type?: number
          created_at?: string
          description?: string | null
          domain?: string
          hosts?: string[]
          id?: string
          logo_url?: string | null
          origin_country?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      agent_conversation_files: {
        Row: {
          archive_inner_path: string
          conversation_id: string
          created_at: string
          customer_storage: Json | null
          device_id: string | null
          file_external_id: string
          file_name: string | null
          id: string
          message_external_id: string
          message_timestamp: string | null
          mime_type: string | null
          org_id: string
          sandbox_id: string | null
          size_bytes: number | null
          updated_at: string
        }
        Insert: {
          archive_inner_path?: string
          conversation_id: string
          created_at?: string
          customer_storage?: Json | null
          device_id?: string | null
          file_external_id: string
          file_name?: string | null
          id?: string
          message_external_id: string
          message_timestamp?: string | null
          mime_type?: string | null
          org_id: string
          sandbox_id?: string | null
          size_bytes?: number | null
          updated_at?: string
        }
        Update: {
          archive_inner_path?: string
          conversation_id?: string
          created_at?: string
          customer_storage?: Json | null
          device_id?: string | null
          file_external_id?: string
          file_name?: string | null
          id?: string
          message_external_id?: string
          message_timestamp?: string | null
          mime_type?: string | null
          org_id?: string
          sandbox_id?: string | null
          size_bytes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversation_files_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversation_files_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_conversation_files_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversation_files_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_conversation_files_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_conversation_files_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversation_files_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_conversation_files_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversation_files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversation_files_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversation_files_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_conversations: {
        Row: {
          agent_account_id: string
          conversation_create_time: string | null
          conversation_external_id: string
          conversation_update_time: string | null
          created_at: string
          customer_storage: Json | null
          device_id: string | null
          id: string
          is_archived: boolean
          name: string | null
          org_id: string
          sandbox_id: string | null
          updated_at: string
        }
        Insert: {
          agent_account_id: string
          conversation_create_time?: string | null
          conversation_external_id: string
          conversation_update_time?: string | null
          created_at?: string
          customer_storage?: Json | null
          device_id?: string | null
          id?: string
          is_archived?: boolean
          name?: string | null
          org_id: string
          sandbox_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_account_id?: string
          conversation_create_time?: string | null
          conversation_external_id?: string
          conversation_update_time?: string | null
          created_at?: string
          customer_storage?: Json | null
          device_id?: string | null
          id?: string
          is_archived?: boolean
          name?: string | null
          org_id?: string
          sandbox_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "active_agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_conversations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_conversations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_conversations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_conversations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_instances: {
        Row: {
          agent_catalog_id: string | null
          agent_deployment: number
          agent_type: number
          configuration: Json | null
          created_at: string
          deleted_at: string | null
          device_id: string | null
          id: string
          installations: Json | null
          last_active_at: string | null
          last_seen_at: string
          metadata: Json | null
          org_id: string
          sandbox_id: string | null
          tenant: string
          updated_at: string
        }
        Insert: {
          agent_catalog_id?: string | null
          agent_deployment: number
          agent_type: number
          configuration?: Json | null
          created_at?: string
          deleted_at?: string | null
          device_id?: string | null
          id?: string
          installations?: Json | null
          last_active_at?: string | null
          last_seen_at?: string
          metadata?: Json | null
          org_id: string
          sandbox_id?: string | null
          tenant: string
          updated_at?: string
        }
        Update: {
          agent_catalog_id?: string | null
          agent_deployment?: number
          agent_type?: number
          configuration?: Json | null
          created_at?: string
          deleted_at?: string | null
          device_id?: string | null
          id?: string
          installations?: Json | null
          last_active_at?: string | null
          last_seen_at?: string
          metadata?: Json | null
          org_id?: string
          sandbox_id?: string | null
          tenant?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_instances_agent_catalog_id_fkey"
            columns: ["agent_catalog_id"]
            isOneToOne: false
            referencedRelation: "agent_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_instances_accounts: {
        Row: {
          agent_account_id: string
          agent_instance_id: string
          created_at: string
          device_id: string | null
          id: string
          org_id: string
          sandbox_id: string | null
          updated_at: string
        }
        Insert: {
          agent_account_id: string
          agent_instance_id: string
          created_at?: string
          device_id?: string | null
          id?: string
          org_id: string
          sandbox_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_account_id?: string
          agent_instance_id?: string
          created_at?: string
          device_id?: string | null
          id?: string
          org_id?: string
          sandbox_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_instances_accounts_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "active_agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "active_agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_issues: {
        Row: {
          agent_account_id: string | null
          agent_instance_id: string | null
          agent_type: number
          cloud_agent_id: string | null
          created_at: string
          device_id: string | null
          id: string
          issue_status: number
          issue_type_control_id: string
          last_seen_at: string
          metadata: Json | null
          org_id: string
          plan: number
          sandbox_id: string | null
          updated_at: string
        }
        Insert: {
          agent_account_id?: string | null
          agent_instance_id?: string | null
          agent_type: number
          cloud_agent_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          issue_status?: number
          issue_type_control_id: string
          last_seen_at?: string
          metadata?: Json | null
          org_id: string
          plan: number
          sandbox_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_account_id?: string | null
          agent_instance_id?: string | null
          agent_type?: number
          cloud_agent_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          issue_status?: number
          issue_type_control_id?: string
          last_seen_at?: string
          metadata?: Json | null
          org_id?: string
          plan?: number
          sandbox_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_issues_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "active_agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "active_agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_cloud_agent_fkey"
            columns: ["cloud_agent_id"]
            isOneToOne: false
            referencedRelation: "cloud_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_issue_type_id_fkey"
            columns: ["issue_type_control_id"]
            isOneToOne: false
            referencedRelation: "issue_type_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_issues_alerts: {
        Row: {
          created_at: string
          id: string
          issue_id: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_issues_alerts_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "agent_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_alerts_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_with_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_remediation_compatibility: {
        Row: {
          agent_type: number
          created_at: string
          id: string
          is_available: boolean
          remediation_id: string
          risk_rule_id: string
          updated_at: string
        }
        Insert: {
          agent_type: number
          created_at?: string
          id?: string
          is_available?: boolean
          remediation_id: string
          risk_rule_id: string
          updated_at?: string
        }
        Update: {
          agent_type?: number
          created_at?: string
          id?: string
          is_available?: boolean
          remediation_id?: string
          risk_rule_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_remediation_compat_agent_type_fkey"
            columns: ["agent_type"]
            isOneToOne: false
            referencedRelation: "agent_catalog"
            referencedColumns: ["agent_type"]
          },
          {
            foreignKeyName: "agent_remediation_compat_remediation_id_fkey"
            columns: ["remediation_id"]
            isOneToOne: false
            referencedRelation: "remediations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_remediation_compat_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_remediation_compat_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_remediation_compat_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_remediation_compat_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_remediation_compat_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_risk_scores: {
        Row: {
          agent_account_id: string | null
          agent_instance_id: string | null
          agent_type: number
          created_at: string
          device_id: string | null
          id: string
          org_id: string
          plan: number
          risk_rule_id: string | null
          sandbox_id: string | null
          score: number | null
          updated_at: string
        }
        Insert: {
          agent_account_id?: string | null
          agent_instance_id?: string | null
          agent_type: number
          created_at?: string
          device_id?: string | null
          id?: string
          org_id: string
          plan: number
          risk_rule_id?: string | null
          sandbox_id?: string | null
          score?: number | null
          updated_at?: string
        }
        Update: {
          agent_account_id?: string | null
          agent_instance_id?: string | null
          agent_type?: number
          created_at?: string
          device_id?: string | null
          id?: string
          org_id?: string
          plan?: number
          risk_rule_id?: string | null
          sandbox_id?: string | null
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_risk_scores_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "active_agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_risk_scores_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_risk_scores_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "active_agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_risk_scores_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_risk_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_risk_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_risk_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_risk_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_risk_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_risk_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_risk_scores_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_risk_scores_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_risk_scores_agg: {
        Row: {
          agent_type: number
          created_at: string
          id: string
          org_id: string
          plan: number
          risk_rule_id: string
          score: number | null
          updated_at: string
        }
        Insert: {
          agent_type: number
          created_at?: string
          id?: string
          org_id: string
          plan: number
          risk_rule_id: string
          score?: number | null
          updated_at?: string
        }
        Update: {
          agent_type?: number
          created_at?: string
          id?: string
          org_id?: string
          plan?: number
          risk_rule_id?: string
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_risk_scores_agg_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_risk_scores_agg_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_risk_scores_agg_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_risk_scores_agg_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_risk_scores_agg_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "agent_risk_scores_agg_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          active_issues: number | null
          active_users: number | null
          actual_score: number | null
          affected_devices: number | null
          agent_catalog_id: string | null
          agent_status: number
          agent_type: number
          base_score: number | null
          created_at: string
          deleted_at: string | null
          deployment_types: number[] | null
          first_seen_at: string | null
          has_host_instances: boolean | null
          id: string
          instance_count: number | null
          last_active_at: string | null
          last_reviewed: string | null
          org_id: string
          plan: number
          sandbox_runtime_types: number[] | null
          total_incidents: number | null
          updated_at: string
        }
        Insert: {
          active_issues?: number | null
          active_users?: number | null
          actual_score?: number | null
          affected_devices?: number | null
          agent_catalog_id?: string | null
          agent_status?: number
          agent_type: number
          base_score?: number | null
          created_at?: string
          deleted_at?: string | null
          deployment_types?: number[] | null
          first_seen_at?: string | null
          has_host_instances?: boolean | null
          id?: string
          instance_count?: number | null
          last_active_at?: string | null
          last_reviewed?: string | null
          org_id: string
          plan: number
          sandbox_runtime_types?: number[] | null
          total_incidents?: number | null
          updated_at?: string
        }
        Update: {
          active_issues?: number | null
          active_users?: number | null
          actual_score?: number | null
          affected_devices?: number | null
          agent_catalog_id?: string | null
          agent_status?: number
          agent_type?: number
          base_score?: number | null
          created_at?: string
          deleted_at?: string | null
          deployment_types?: number[] | null
          first_seen_at?: string | null
          has_host_instances?: boolean | null
          id?: string
          instance_count?: number | null
          last_active_at?: string | null
          last_reviewed?: string | null
          org_id?: string
          plan?: number
          sandbox_runtime_types?: number[] | null
          total_incidents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_agent_catalog_id_fkey"
            columns: ["agent_catalog_id"]
            isOneToOne: false
            referencedRelation: "agent_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      api_clients: {
        Row: {
          client_secret: string
          created_at: string
          expiry: string | null
          id: string
          jwt: string
          name: string | null
          org_id: string
          refresh_token: string | null
          session_id: string | null
          updated_at: string
        }
        Insert: {
          client_secret: string
          created_at?: string
          expiry?: string | null
          id?: string
          jwt: string
          name?: string | null
          org_id: string
          refresh_token?: string | null
          session_id?: string | null
          updated_at?: string
        }
        Update: {
          client_secret?: string
          created_at?: string
          expiry?: string | null
          id?: string
          jwt?: string
          name?: string | null
          org_id?: string
          refresh_token?: string | null
          session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_agent_gateways: {
        Row: {
          agent_id: string
          created_at: string
          gateway_id: string
          org_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          gateway_id: string
          org_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          gateway_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_agent_gateways_agent_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "cloud_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_agent_gateways_gateway_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "cloud_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_agent_gateways_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_agents: {
        Row: {
          agent_kind: number
          compute_type: number
          configuration: Json
          connection_id: string
          created_at: string
          deleted_at: string | null
          id: string
          last_active_at: string | null
          last_seen_at: string
          name: string | null
          native_id: string
          native_status: string | null
          org_id: string
          region: string | null
          status: number
          updated_at: string
        }
        Insert: {
          agent_kind: number
          compute_type?: number
          configuration?: Json
          connection_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_active_at?: string | null
          last_seen_at?: string
          name?: string | null
          native_id: string
          native_status?: string | null
          org_id: string
          region?: string | null
          status?: number
          updated_at?: string
        }
        Update: {
          agent_kind?: number
          compute_type?: number
          configuration?: Json
          connection_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_active_at?: string | null
          last_seen_at?: string
          name?: string | null
          native_id?: string
          native_status?: string | null
          org_id?: string
          region?: string | null
          status?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_agents_connection_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "cloud_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_agents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_connections: {
        Row: {
          account_ref: string
          auth_config: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          error_code: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          org_id: string
          provider: number
          regions: string[] | null
          status: number
          updated_at: string
        }
        Insert: {
          account_ref: string
          auth_config?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          error_code?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          org_id: string
          provider: number
          regions?: string[] | null
          status?: number
          updated_at?: string
        }
        Update: {
          account_ref?: string
          auth_config?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          error_code?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          org_id?: string
          provider?: number
          regions?: string[] | null
          status?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_gateways: {
        Row: {
          configuration: Json
          connection_id: string
          created_at: string
          deleted_at: string | null
          gateway_type: number
          gateway_url: string | null
          id: string
          last_seen_at: string
          name: string
          native_id: string
          native_status: string | null
          org_id: string
          raw_response: Json | null
          region: string
          status: number
          updated_at: string
        }
        Insert: {
          configuration?: Json
          connection_id: string
          created_at?: string
          deleted_at?: string | null
          gateway_type?: number
          gateway_url?: string | null
          id?: string
          last_seen_at?: string
          name: string
          native_id: string
          native_status?: string | null
          org_id: string
          raw_response?: Json | null
          region: string
          status?: number
          updated_at?: string
        }
        Update: {
          configuration?: Json
          connection_id?: string
          created_at?: string
          deleted_at?: string | null
          gateway_type?: number
          gateway_url?: string | null
          id?: string
          last_seen_at?: string
          name?: string
          native_id?: string
          native_status?: string | null
          org_id?: string
          raw_response?: Json | null
          region?: string
          status?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_gateways_connection_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "cloud_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_gateways_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_containment_findings: {
        Row: {
          conversation_id: string
          conversation_storage: Json | null
          created_at: string
          customer_storage: Json | null
          detected_at: string | null
          device_id: string | null
          finding_status: number
          hook_event_name: string | null
          id: string
          metadata: Json | null
          op: number
          operation: string
          org_id: string
          outcome: number
          prompt_id: string | null
          risky_action_category: number
          risky_action_subcategory: number
          sandbox_id: string | null
          tool_name: string
          tool_use_id: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          conversation_storage?: Json | null
          created_at?: string
          customer_storage?: Json | null
          detected_at?: string | null
          device_id?: string | null
          finding_status?: number
          hook_event_name?: string | null
          id?: string
          metadata?: Json | null
          op?: number
          operation?: string
          org_id: string
          outcome?: number
          prompt_id?: string | null
          risky_action_category?: number
          risky_action_subcategory?: number
          sandbox_id?: string | null
          tool_name?: string
          tool_use_id: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          conversation_storage?: Json | null
          created_at?: string
          customer_storage?: Json | null
          detected_at?: string | null
          device_id?: string | null
          finding_status?: number
          hook_event_name?: string | null
          id?: string
          metadata?: Json | null
          op?: number
          operation?: string
          org_id?: string
          outcome?: number
          prompt_id?: string | null
          risky_action_category?: number
          risky_action_subcategory?: number
          sandbox_id?: string | null
          tool_name?: string
          tool_use_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_containment_findings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_containment_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "connector_containment_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_containment_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "connector_containment_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "connector_containment_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_containment_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "connector_containment_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_containment_findings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_containment_findings_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_containment_findings_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_storage_configs: {
        Row: {
          config: Json
          config_version: number
          created_at: string
          error_code: number | null
          id: string
          is_customer_error: boolean | null
          last_error: string | null
          last_validated_at: string | null
          org_id: string
          provider: number
          sensitive_data_capture_enabled: boolean
          status: number
          updated_at: string
        }
        Insert: {
          config?: Json
          config_version?: number
          created_at?: string
          error_code?: number | null
          id?: string
          is_customer_error?: boolean | null
          last_error?: string | null
          last_validated_at?: string | null
          org_id: string
          provider: number
          sensitive_data_capture_enabled?: boolean
          status?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          config_version?: number
          created_at?: string
          error_code?: number | null
          id?: string
          is_customer_error?: boolean | null
          last_error?: string | null
          last_validated_at?: string | null
          org_id?: string
          provider?: number
          sensitive_data_capture_enabled?: boolean
          status?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_storage_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      datalakes: {
        Row: {
          created_at: string
          environment_native_id: string
          hosting_environment_id: string
          id: string
          metadata: Json
          name: string
          org_id: string
          region: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          environment_native_id: string
          hosting_environment_id: string
          id?: string
          metadata?: Json
          name: string
          org_id: string
          region: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          environment_native_id?: string
          hosting_environment_id?: string
          id?: string
          metadata?: Json
          name?: string
          org_id?: string
          region?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "datalakes_hosting_environment_id_fkey"
            columns: ["hosting_environment_id"]
            isOneToOne: false
            referencedRelation: "hosting_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datalakes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      device_certificates: {
        Row: {
          ca_id: string
          created_at: string
          device_native_id: string
          device_uuid: string | null
          expires_at: string
          id: string
          issued_at: string
          org_id: string
          serial: string
          updated_at: string
        }
        Insert: {
          ca_id: string
          created_at?: string
          device_native_id: string
          device_uuid?: string | null
          expires_at: string
          id?: string
          issued_at?: string
          org_id: string
          serial: string
          updated_at?: string
        }
        Update: {
          ca_id?: string
          created_at?: string
          device_native_id?: string
          device_uuid?: string | null
          expires_at?: string
          id?: string
          issued_at?: string
          org_id?: string
          serial?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_certificates_ca_id_fkey"
            columns: ["ca_id"]
            isOneToOne: false
            referencedRelation: "org_certificate_authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_certificates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      device_component_versions: {
        Row: {
          component: string
          created_at: string
          device_id: string
          id: string
          instance_id: string | null
          org_id: string
          request_id: string
          updated_at: string
          version: string
        }
        Insert: {
          component: string
          created_at?: string
          device_id: string
          id?: string
          instance_id?: string | null
          org_id: string
          request_id: string
          updated_at?: string
          version: string
        }
        Update: {
          component?: string
          created_at?: string
          device_id?: string
          id?: string
          instance_id?: string | null
          org_id?: string
          request_id?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_component_versions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_component_versions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_component_versions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_component_versions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_component_versions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_component_versions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_component_versions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_component_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      device_owner_mappings: {
        Row: {
          created_at: string
          device_native_id: string
          id: string
          mdm_integration_id: string
          org_id: string
          owner_email: string | null
          owner_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_native_id: string
          id?: string
          mdm_integration_id: string
          org_id: string
          owner_email?: string | null
          owner_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_native_id?: string
          id?: string
          mdm_integration_id?: string
          org_id?: string
          owner_email?: string | null
          owner_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_owner_mappings_mdm_integration_id_fkey"
            columns: ["mdm_integration_id"]
            isOneToOne: false
            referencedRelation: "mdm_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_owner_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      device_registrations: {
        Row: {
          created_at: string
          device_native_id: string
          device_uuid: string | null
          id: string
          org_id: string
        }
        Insert: {
          created_at?: string
          device_native_id: string
          device_uuid?: string | null
          id?: string
          org_id: string
        }
        Update: {
          created_at?: string
          device_native_id?: string
          device_uuid?: string | null
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_registrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      device_scans: {
        Row: {
          created_at: string
          device_id: string
          id: string
          last_scan_time: string
          org_id: string
          scan_type: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          last_scan_time: string
          org_id: string
          scan_type: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          last_scan_time?: string
          org_id?: string
          scan_type?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_scans_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_scans_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_scans_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_scans_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_scans_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_scans_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_scans_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_scans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      device_upgrade_state: {
        Row: {
          created_at: string
          device_native_id: string
          device_uuid: string | null
          id: string
          next_offer_at: string
          offered_artifact: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_native_id: string
          device_uuid?: string | null
          id?: string
          next_offer_at: string
          offered_artifact: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_native_id?: string
          device_uuid?: string | null
          id?: string
          next_offer_at?: string
          offered_artifact?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_upgrade_state_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          account_metadata: Json | null
          architecture: string | null
          chip_model: string | null
          created_at: string
          deleted_at: string | null
          device_native_id: string
          device_uuid: string | null
          friendly_name: string | null
          id: string
          last_seen_at: string
          management_authorities: number[] | null
          org_id: string
          os_version: string | null
          platform: string | null
          updated_at: string
          windows_product_type: number | null
        }
        Insert: {
          account_metadata?: Json | null
          architecture?: string | null
          chip_model?: string | null
          created_at?: string
          deleted_at?: string | null
          device_native_id: string
          device_uuid?: string | null
          friendly_name?: string | null
          id?: string
          last_seen_at?: string
          management_authorities?: number[] | null
          org_id: string
          os_version?: string | null
          platform?: string | null
          updated_at?: string
          windows_product_type?: number | null
        }
        Update: {
          account_metadata?: Json | null
          architecture?: string | null
          chip_model?: string | null
          created_at?: string
          deleted_at?: string | null
          device_native_id?: string
          device_uuid?: string | null
          friendly_name?: string | null
          id?: string
          last_seen_at?: string
          management_authorities?: number[] | null
          org_id?: string
          os_version?: string | null
          platform?: string | null
          updated_at?: string
          windows_product_type?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_defaults: {
        Row: {
          created_at: string
          enabled: boolean
          name: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          name: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          enabled?: boolean
          name?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      hosting_environments: {
        Row: {
          cloud_provider: string
          created_at: string
          id: string
          infrastructure_output: Json
          metadata: Json
          name: string
          native_id: string
          org_id: string
          status: string
          terraform_module_versions: Json
          terraform_url: string | null
          type: string
          updated_at: string
        }
        Insert: {
          cloud_provider: string
          created_at?: string
          id?: string
          infrastructure_output?: Json
          metadata?: Json
          name: string
          native_id: string
          org_id: string
          status?: string
          terraform_module_versions?: Json
          terraform_url?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          cloud_provider?: string
          created_at?: string
          id?: string
          infrastructure_output?: Json
          metadata?: Json
          name?: string
          native_id?: string
          org_id?: string
          status?: string
          terraform_module_versions?: Json
          terraform_url?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hosting_environments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      idp_directory_users: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_name: string | null
          email: string
          external_idp_id: string | null
          external_updated_at: string | null
          external_user_id: string
          first_name: string | null
          id: string
          idp_integration_id: string
          last_name: string | null
          last_seen_at: string | null
          org_id: string
          raw_attributes: Json
          state: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email: string
          external_idp_id?: string | null
          external_updated_at?: string | null
          external_user_id: string
          first_name?: string | null
          id?: string
          idp_integration_id: string
          last_name?: string | null
          last_seen_at?: string | null
          org_id: string
          raw_attributes?: Json
          state?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string
          external_idp_id?: string | null
          external_updated_at?: string | null
          external_user_id?: string
          first_name?: string | null
          id?: string
          idp_integration_id?: string
          last_name?: string | null
          last_seen_at?: string | null
          org_id?: string
          raw_attributes?: Json
          state?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "idp_directory_users_integration_fkey"
            columns: ["idp_integration_id"]
            isOneToOne: false
            referencedRelation: "idp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idp_directory_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      idp_integrations: {
        Row: {
          created_at: string
          creds_secret_arn: string | null
          creds_version: number
          directory_state: string | null
          directory_type: string | null
          disconnected_at: string | null
          error_code: number | null
          id: string
          is_customer_error: boolean | null
          last_error: string | null
          last_reconciled_at: string | null
          last_synced: string | null
          org_id: string
          provider: number
          status: number
          sync_cursor: string | null
          sync_cursor_event_at: string | null
          updated_at: string
          workos_directory_id: string | null
          workos_organization_id: string | null
        }
        Insert: {
          created_at?: string
          creds_secret_arn?: string | null
          creds_version?: number
          directory_state?: string | null
          directory_type?: string | null
          disconnected_at?: string | null
          error_code?: number | null
          id?: string
          is_customer_error?: boolean | null
          last_error?: string | null
          last_reconciled_at?: string | null
          last_synced?: string | null
          org_id: string
          provider: number
          status?: number
          sync_cursor?: string | null
          sync_cursor_event_at?: string | null
          updated_at?: string
          workos_directory_id?: string | null
          workos_organization_id?: string | null
        }
        Update: {
          created_at?: string
          creds_secret_arn?: string | null
          creds_version?: number
          directory_state?: string | null
          directory_type?: string | null
          disconnected_at?: string | null
          error_code?: number | null
          id?: string
          is_customer_error?: boolean | null
          last_error?: string | null
          last_reconciled_at?: string | null
          last_synced?: string | null
          org_id?: string
          provider?: number
          status?: number
          sync_cursor?: string | null
          sync_cursor_event_at?: string | null
          updated_at?: string
          workos_directory_id?: string | null
          workos_organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idp_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          created_at: string
          error_code: number | null
          id: string
          integration_type: number
          is_customer_error: boolean | null
          last_checked: string | null
          last_error: string | null
          name: string
          org_id: string
          status: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_code?: number | null
          id?: string
          integration_type: number
          is_customer_error?: boolean | null
          last_checked?: string | null
          last_error?: string | null
          name: string
          org_id: string
          status?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_code?: number | null
          id?: string
          integration_type?: number
          is_customer_error?: boolean | null
          last_checked?: string | null
          last_error?: string | null
          name?: string
          org_id?: string
          status?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_type_controls: {
        Row: {
          created_at: string
          id: string
          issue_type_id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_type_id: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_type_id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_type_controls_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "issue_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_types: {
        Row: {
          applicable_to: number
          created_at: string
          description: string | null
          display_order: number | null
          entity_type: number
          expected_value: string | null
          id: string
          issue_detail: number
          name: string
          remediation_text: string
          risk_rule_id: string
          trigger_score: number
          updated_at: string
        }
        Insert: {
          applicable_to?: number
          created_at?: string
          description?: string | null
          display_order?: number | null
          entity_type: number
          expected_value?: string | null
          id?: string
          issue_detail: number
          name: string
          remediation_text?: string
          risk_rule_id: string
          trigger_score: number
          updated_at?: string
        }
        Update: {
          applicable_to?: number
          created_at?: string
          description?: string | null
          display_order?: number | null
          entity_type?: number
          expected_value?: string | null
          id?: string
          issue_detail?: number
          name?: string
          remediation_text?: string
          risk_rule_id?: string
          trigger_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_types_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "issue_types_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "issue_types_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "issue_types_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "issue_types_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_host_catalog: {
        Row: {
          created_at: string
          host_pattern: string
          id: string
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          host_pattern: string
          id?: string
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          host_pattern?: string
          id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      llm_model_catalog: {
        Row: {
          created_at: string
          description: string | null
          detection_patterns: string[]
          hosted_by: string[]
          id: string
          llm_model_type: number
          logo_url: string | null
          model_family: string | null
          model_name: string
          origin_country: string
          publisher: string
          updated_at: string
          website: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          detection_patterns?: string[]
          hosted_by?: string[]
          id?: string
          llm_model_type: number
          logo_url?: string | null
          model_family?: string | null
          model_name: string
          origin_country: string
          publisher: string
          updated_at?: string
          website?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          detection_patterns?: string[]
          hosted_by?: string[]
          id?: string
          llm_model_type?: number
          logo_url?: string | null
          model_family?: string | null
          model_name?: string
          origin_country?: string
          publisher?: string
          updated_at?: string
          website?: string | null
          weight?: number
        }
        Relationships: []
      }
      llm_model_instances: {
        Row: {
          api_host: string
          created_at: string
          deleted_at: string | null
          device_id: string | null
          id: string
          last_seen_at: string
          llm_model_native_id: string
          llm_model_type: number
          org_id: string
          sandbox_id: string | null
          updated_at: string
        }
        Insert: {
          api_host: string
          created_at?: string
          deleted_at?: string | null
          device_id?: string | null
          id?: string
          last_seen_at?: string
          llm_model_native_id: string
          llm_model_type: number
          org_id: string
          sandbox_id?: string | null
          updated_at?: string
        }
        Update: {
          api_host?: string
          created_at?: string
          deleted_at?: string | null
          device_id?: string | null
          id?: string
          last_seen_at?: string
          llm_model_native_id?: string
          llm_model_type?: number
          org_id?: string
          sandbox_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_model_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_model_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_model_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_models: {
        Row: {
          active_devices: number | null
          created_at: string
          deleted_at: string | null
          first_seen_at: string | null
          id: string
          instance_count: number | null
          last_seen_at: string | null
          llm_model_type: number
          org_id: string
          updated_at: string
        }
        Insert: {
          active_devices?: number | null
          created_at?: string
          deleted_at?: string | null
          first_seen_at?: string | null
          id?: string
          instance_count?: number | null
          last_seen_at?: string | null
          llm_model_type: number
          org_id: string
          updated_at?: string
        }
        Update: {
          active_devices?: number | null
          created_at?: string
          deleted_at?: string | null
          first_seen_at?: string | null
          id?: string
          instance_count?: number | null
          last_seen_at?: string | null
          llm_model_type?: number
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_models_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_access_decisions: {
        Row: {
          action: number
          created_at: string
          decided_by: string | null
          decision_reason: string | null
          group_id: string | null
          group_name: string | null
          id: string
          mcp_server_type: number
          org_id: string
          scope_type: number
        }
        Insert: {
          action: number
          created_at?: string
          decided_by?: string | null
          decision_reason?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          mcp_server_type: number
          org_id: string
          scope_type: number
        }
        Update: {
          action?: number
          created_at?: string
          decided_by?: string | null
          decision_reason?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          mcp_server_type?: number
          org_id?: string
          scope_type?: number
        }
        Relationships: [
          {
            foreignKeyName: "mcp_access_decisions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "active_user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_access_decisions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_access_decisions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_access_requests: {
        Row: {
          created_at: string
          decision_id: string | null
          id: string
          mcp_server_type: number
          org_id: string
          reason: string
          requester_id: string
          resolution_note: string | null
          resolved_at: string | null
          status: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision_id?: string | null
          id?: string
          mcp_server_type: number
          org_id: string
          reason: string
          requester_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision_id?: string | null
          id?: string
          mcp_server_type?: number
          org_id?: string
          reason?: string
          requester_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_access_requests_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "mcp_access_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_access_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_baseline_scores_staging: {
        Row: {
          applicable_to: number
          attribute_id: number
          created_at: string
          id: string
          llm_model: string
          name: string
          rationale: string | null
          rule_id: string
          score: number | null
          source_type: number
          updated_at: string
        }
        Insert: {
          applicable_to: number
          attribute_id: number
          created_at?: string
          id?: string
          llm_model: string
          name: string
          rationale?: string | null
          rule_id: string
          score?: number | null
          source_type: number
          updated_at?: string
        }
        Update: {
          applicable_to?: number
          attribute_id?: number
          created_at?: string
          id?: string
          llm_model?: string
          name?: string
          rationale?: string | null
          rule_id?: string
          score?: number | null
          source_type?: number
          updated_at?: string
        }
        Relationships: []
      }
      mcp_catalog: {
        Row: {
          authentication_methods: number[] | null
          category_id: string | null
          created_at: string
          description: string | null
          detection_patterns: Json
          execution_environment: number[] | null
          external_id: string | null
          id: string
          logo_url: string | null
          mcp_server_name: string
          mcp_server_type: number
          source_type: number
          updated_at: string
          website: string | null
        }
        Insert: {
          authentication_methods?: number[] | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          detection_patterns?: Json
          execution_environment?: number[] | null
          external_id?: string | null
          id?: string
          logo_url?: string | null
          mcp_server_name: string
          mcp_server_type: number
          source_type?: number
          updated_at?: string
          website?: string | null
        }
        Update: {
          authentication_methods?: number[] | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          detection_patterns?: Json
          execution_environment?: number[] | null
          external_id?: string | null
          id?: string
          logo_url?: string | null
          mcp_server_name?: string
          mcp_server_type?: number
          source_type?: number
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_catalog_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "mcp_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_catalog_agent_directories: {
        Row: {
          agent_type: number
          created_at: string
          id: string
          mcp_server_type: number
          updated_at: string
        }
        Insert: {
          agent_type: number
          created_at?: string
          id?: string
          mcp_server_type: number
          updated_at?: string
        }
        Update: {
          agent_type?: number
          created_at?: string
          id?: string
          mcp_server_type?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_catalog_agent_directories_agent_type_fkey"
            columns: ["agent_type"]
            isOneToOne: false
            referencedRelation: "agent_catalog"
            referencedColumns: ["agent_type"]
          },
          {
            foreignKeyName: "mcp_catalog_agent_directories_mcp_server_type_fkey"
            columns: ["mcp_server_type"]
            isOneToOne: false
            referencedRelation: "mcp_catalog"
            referencedColumns: ["mcp_server_type"]
          },
        ]
      }
      mcp_catalog_tools: {
        Row: {
          created_at: string
          description: string | null
          id: string
          input_schema: Json
          mcp_server_type: number
          name: string
          permission_type: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          input_schema?: Json
          mcp_server_type: number
          name: string
          permission_type?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          input_schema?: Json
          mcp_server_type?: number
          name?: string
          permission_type?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_catalog_tools_mcp_server_type_fkey"
            columns: ["mcp_server_type"]
            isOneToOne: false
            referencedRelation: "mcp_catalog"
            referencedColumns: ["mcp_server_type"]
          },
        ]
      }
      mcp_categories: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          resource_type: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          name: string
          resource_type: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          resource_type?: number
          updated_at?: string
        }
        Relationships: []
      }
      mcp_remediation_compatibility: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          mcp_server_type: number
          remediation_id: string
          risk_rule_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          mcp_server_type: number
          remediation_id: string
          risk_rule_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          mcp_server_type?: number
          remediation_id?: string
          risk_rule_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_remediation_compat_mcp_server_type_fkey"
            columns: ["mcp_server_type"]
            isOneToOne: false
            referencedRelation: "mcp_catalog"
            referencedColumns: ["mcp_server_type"]
          },
          {
            foreignKeyName: "mcp_remediation_compat_remediation_id_fkey"
            columns: ["remediation_id"]
            isOneToOne: false
            referencedRelation: "remediations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_remediation_compat_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_remediation_compat_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_remediation_compat_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_remediation_compat_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_remediation_compat_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_agent_instances: {
        Row: {
          agent_instance_id: string
          created_at: string
          device_id: string | null
          id: string
          mcp_server_instance_id: string
          org_id: string
          sandbox_id: string | null
          updated_at: string
        }
        Insert: {
          agent_instance_id: string
          created_at?: string
          device_id?: string | null
          id?: string
          mcp_server_instance_id: string
          org_id: string
          sandbox_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_instance_id?: string
          created_at?: string
          device_id?: string | null
          id?: string
          mcp_server_instance_id?: string
          org_id?: string
          sandbox_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_agent_instances_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "active_agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_server_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_plans_expanded"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_with_agent_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_baseline_scores: {
        Row: {
          applicable_to: number
          created_at: string
          id: string
          mcp_server_type: number
          metadata: Json | null
          rationale: string | null
          risk_rule_id: string
          score: number | null
          updated_at: string
        }
        Insert: {
          applicable_to?: number
          created_at?: string
          id?: string
          mcp_server_type: number
          metadata?: Json | null
          rationale?: string | null
          risk_rule_id: string
          score?: number | null
          updated_at?: string
        }
        Update: {
          applicable_to?: number
          created_at?: string
          id?: string
          mcp_server_type?: number
          metadata?: Json | null
          rationale?: string | null
          risk_rule_id?: string
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_baseline_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_server_baseline_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_server_baseline_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_server_baseline_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_server_baseline_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_instances: {
        Row: {
          agent_account_id: string | null
          agent_type: number
          auth_type: number
          cloud_connection_id: string | null
          cloud_gateway_id: string | null
          created_at: string
          deleted_at: string | null
          deployment_model: number
          device_id: string | null
          distribution_channel: number
          external_id: string | null
          id: string
          last_seen_at: string
          linked_plans: number[] | null
          mcp_native_id: string
          mcp_server_id: string | null
          mcp_server_location: string
          mcp_server_type: number
          metadata: Json | null
          org_id: string
          project_path: string | null
          region: string | null
          sandbox_id: string | null
          security_findings: Json | null
          tools: Json | null
          transport_security_type: number
          transport_type: number
          updated_at: string
        }
        Insert: {
          agent_account_id?: string | null
          agent_type: number
          auth_type: number
          cloud_connection_id?: string | null
          cloud_gateway_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deployment_model: number
          device_id?: string | null
          distribution_channel?: number
          external_id?: string | null
          id?: string
          last_seen_at?: string
          linked_plans?: number[] | null
          mcp_native_id: string
          mcp_server_id?: string | null
          mcp_server_location: string
          mcp_server_type: number
          metadata?: Json | null
          org_id: string
          project_path?: string | null
          region?: string | null
          sandbox_id?: string | null
          security_findings?: Json | null
          tools?: Json | null
          transport_security_type: number
          transport_type: number
          updated_at?: string
        }
        Update: {
          agent_account_id?: string | null
          agent_type?: number
          auth_type?: number
          cloud_connection_id?: string | null
          cloud_gateway_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deployment_model?: number
          device_id?: string | null
          distribution_channel?: number
          external_id?: string | null
          id?: string
          last_seen_at?: string
          linked_plans?: number[] | null
          mcp_native_id?: string
          mcp_server_id?: string | null
          mcp_server_location?: string
          mcp_server_type?: number
          metadata?: Json | null
          org_id?: string
          project_path?: string | null
          region?: string | null
          sandbox_id?: string | null
          security_findings?: Json | null
          tools?: Json | null
          transport_security_type?: number
          transport_type?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_instances_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "active_agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_cloud_connection_fkey"
            columns: ["cloud_connection_id"]
            isOneToOne: false
            referencedRelation: "cloud_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_cloud_gateway_fkey"
            columns: ["cloud_gateway_id"]
            isOneToOne: false
            referencedRelation: "cloud_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_issues: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          issue_status: number
          issue_type_control_id: string
          last_seen_at: string
          mcp_server_instance_id: string | null
          mcp_server_type: number
          metadata: Json | null
          org_id: string
          sandbox_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          issue_status?: number
          issue_type_control_id: string
          last_seen_at?: string
          mcp_server_instance_id?: string | null
          mcp_server_type: number
          metadata?: Json | null
          org_id: string
          sandbox_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          issue_status?: number
          issue_type_control_id?: string
          last_seen_at?: string
          mcp_server_instance_id?: string | null
          mcp_server_type?: number
          metadata?: Json | null
          org_id?: string
          sandbox_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_issue_type_id_fkey"
            columns: ["issue_type_control_id"]
            isOneToOne: false
            referencedRelation: "issue_type_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_server_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_plans_expanded"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_with_agent_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_issues_alerts: {
        Row: {
          created_at: string
          id: string
          issue_id: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_issues_alerts_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_alerts_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_with_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_risk_scores: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          mcp_server_instance_id: string | null
          mcp_server_type: number
          org_id: string
          risk_rule_id: string | null
          sandbox_id: string | null
          score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          mcp_server_instance_id?: string | null
          mcp_server_type: number
          org_id: string
          risk_rule_id?: string | null
          sandbox_id?: string | null
          score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          mcp_server_instance_id?: string | null
          mcp_server_type?: number
          org_id?: string
          risk_rule_id?: string | null
          sandbox_id?: string | null
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_server_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_plans_expanded"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_with_agent_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_risk_scores_agg: {
        Row: {
          created_at: string
          id: string
          mcp_server_type: number
          org_id: string
          risk_rule_id: string
          score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mcp_server_type: number
          org_id: string
          risk_rule_id: string
          score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mcp_server_type?: number
          org_id?: string
          risk_rule_id?: string
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_risk_scores_agg_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_agg_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_agg_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_agg_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_agg_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "mcp_server_risk_scores_agg_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_servers: {
        Row: {
          active_issues: number | null
          active_users: number | null
          actual_score: number | null
          affected_devices: number | null
          agent_names: Json | null
          auth_types: number[] | null
          base_score: number | null
          created_at: string
          deleted_at: string | null
          distribution_channels: number[] | null
          first_seen_at: string | null
          has_host_instances: boolean | null
          id: string
          instance_count: number | null
          last_reviewed: string | null
          mcp_catalog_id: string | null
          mcp_server_status: number
          mcp_server_type: number
          org_id: string
          sandbox_runtime_types: number[] | null
          total_incidents: number | null
          updated_at: string
        }
        Insert: {
          active_issues?: number | null
          active_users?: number | null
          actual_score?: number | null
          affected_devices?: number | null
          agent_names?: Json | null
          auth_types?: number[] | null
          base_score?: number | null
          created_at?: string
          deleted_at?: string | null
          distribution_channels?: number[] | null
          first_seen_at?: string | null
          has_host_instances?: boolean | null
          id?: string
          instance_count?: number | null
          last_reviewed?: string | null
          mcp_catalog_id?: string | null
          mcp_server_status?: number
          mcp_server_type: number
          org_id: string
          sandbox_runtime_types?: number[] | null
          total_incidents?: number | null
          updated_at?: string
        }
        Update: {
          active_issues?: number | null
          active_users?: number | null
          actual_score?: number | null
          affected_devices?: number | null
          agent_names?: Json | null
          auth_types?: number[] | null
          base_score?: number | null
          created_at?: string
          deleted_at?: string | null
          distribution_channels?: number[] | null
          first_seen_at?: string | null
          has_host_instances?: boolean | null
          id?: string
          instance_count?: number | null
          last_reviewed?: string | null
          mcp_catalog_id?: string | null
          mcp_server_status?: number
          mcp_server_type?: number
          org_id?: string
          sandbox_runtime_types?: number[] | null
          total_incidents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_servers_mcp_catalog_id_fkey"
            columns: ["mcp_catalog_id"]
            isOneToOne: false
            referencedRelation: "mcp_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_servers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      mdm_integrations: {
        Row: {
          created_at: string
          creds_secret_arn: string | null
          creds_version: number
          error_code: number | null
          id: string
          is_customer_error: boolean | null
          last_error: string | null
          last_synced: string | null
          org_id: string
          provider: number
          status: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          creds_secret_arn?: string | null
          creds_version?: number
          error_code?: number | null
          id?: string
          is_customer_error?: boolean | null
          last_error?: string | null
          last_synced?: string | null
          org_id: string
          provider: number
          status?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          creds_secret_arn?: string | null
          creds_version?: number
          error_code?: number | null
          id?: string
          is_customer_error?: boolean | null
          last_error?: string | null
          last_synced?: string | null
          org_id?: string
          provider?: number
          status?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mdm_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_access_grants: {
        Row: {
          child_org_id: string
          created_at: string
          granted_by: string | null
          id: string
          parent_org_id: string
        }
        Insert: {
          child_org_id: string
          created_at?: string
          granted_by?: string | null
          id?: string
          parent_org_id: string
        }
        Update: {
          child_org_id?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          parent_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_access_grants_child_org_id_fkey"
            columns: ["child_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_access_grants_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_certificate_authorities: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          kms_key_arn: string
          org_id: string
          root_cert_pem: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          kms_key_arn: string
          org_id: string
          root_cert_pem: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          kms_key_arn?: string
          org_id?: string
          root_cert_pem?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_certificate_authorities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          name: string
          org_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          org_id: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "org_feature_flags_name_fkey"
            columns: ["name"]
            isOneToOne: false
            referencedRelation: "feature_flag_defaults"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "org_feature_flags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_llm_model_catalog: {
        Row: {
          created_at: string
          description: string | null
          detection_patterns: string[]
          hosted_by: string[]
          id: string
          llm_model_type: number
          logo_url: string | null
          model_family: string | null
          model_name: string
          org_id: string
          origin_country: string
          publisher: string
          updated_at: string
          website: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          detection_patterns?: string[]
          hosted_by?: string[]
          id?: string
          llm_model_type: number
          logo_url?: string | null
          model_family?: string | null
          model_name: string
          org_id: string
          origin_country: string
          publisher: string
          updated_at?: string
          website?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          detection_patterns?: string[]
          hosted_by?: string[]
          id?: string
          llm_model_type?: number
          logo_url?: string | null
          model_family?: string | null
          model_name?: string
          org_id?: string
          origin_country?: string
          publisher?: string
          updated_at?: string
          website?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_llm_model_catalog_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_mcp_catalog: {
        Row: {
          authentication_methods: number[] | null
          category_id: string | null
          created_at: string
          description: string | null
          detection_patterns: Json
          execution_environment: number[] | null
          id: string
          logo_url: string | null
          mcp_server_name: string
          mcp_server_type: number
          org_id: string
          source_type: number
          updated_at: string
          website: string | null
        }
        Insert: {
          authentication_methods?: number[] | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          detection_patterns?: Json
          execution_environment?: number[] | null
          id?: string
          logo_url?: string | null
          mcp_server_name: string
          mcp_server_type: number
          org_id: string
          source_type?: number
          updated_at?: string
          website?: string | null
        }
        Update: {
          authentication_methods?: number[] | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          detection_patterns?: Json
          execution_environment?: number[] | null
          id?: string
          logo_url?: string | null
          mcp_server_name?: string
          mcp_server_type?: number
          org_id?: string
          source_type?: number
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_mcp_catalog_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "mcp_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_mcp_catalog_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          aws_iam_role_arn: string | null
          aws_iam_user_name: string | null
          aws_secret_name: string | null
          created_at: string
          created_by_org_id: string | null
          description: string | null
          email_domain: string
          id: string
          name: string
          source: number
          trial_expires_at: string | null
          updated_at: string
        }
        Insert: {
          aws_iam_role_arn?: string | null
          aws_iam_user_name?: string | null
          aws_secret_name?: string | null
          created_at?: string
          created_by_org_id?: string | null
          description?: string | null
          email_domain: string
          id?: string
          name: string
          source?: number
          trial_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          aws_iam_role_arn?: string | null
          aws_iam_user_name?: string | null
          aws_secret_name?: string | null
          created_at?: string
          created_by_org_id?: string | null
          description?: string | null
          email_domain?: string
          id?: string
          name?: string
          source?: number
          trial_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orgs_created_by_org_id_fkey"
            columns: ["created_by_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      otel_destinations: {
        Row: {
          created_at: string
          enabled: boolean
          endpoint: string
          headers_secret_arn: string | null
          id: string
          name: string
          org_id: string
          protocol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          endpoint: string
          headers_secret_arn?: string | null
          id?: string
          name: string
          org_id: string
          protocol: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          endpoint?: string
          headers_secret_arn?: string | null
          id?: string
          name?: string
          org_id?: string
          protocol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "otel_destinations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_deployments: {
        Row: {
          cp_inbound_queue_url: string
          created_at: string
          deployment_config: Json
          error: string | null
          hosting_environment_id: string
          id: string
          metadata: Json
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cp_inbound_queue_url: string
          created_at?: string
          deployment_config?: Json
          error?: string | null
          hosting_environment_id: string
          id?: string
          metadata?: Json
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cp_inbound_queue_url?: string
          created_at?: string
          deployment_config?: Json
          error?: string | null
          hosting_environment_id?: string
          id?: string
          metadata?: Json
          org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_deployments_hosting_environment_id_fkey"
            columns: ["hosting_environment_id"]
            isOneToOne: false
            referencedRelation: "hosting_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_deployments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          ai_access_config: Json | null
          assignment_type: number
          category: number | null
          created_at: string
          description: string | null
          employee_assignment_type: number
          exception_types: number[]
          framework_id: string
          id: string
          is_default: boolean
          name: string
          org_id: string
          policy_status: number
          risk_threshold: number | null
          updated_at: string
        }
        Insert: {
          ai_access_config?: Json | null
          assignment_type: number
          category?: number | null
          created_at?: string
          description?: string | null
          employee_assignment_type: number
          exception_types?: number[]
          framework_id: string
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          policy_status?: number
          risk_threshold?: number | null
          updated_at?: string
        }
        Update: {
          ai_access_config?: Json | null
          assignment_type?: number
          category?: number | null
          created_at?: string
          description?: string | null
          employee_assignment_type?: number
          exception_types?: number[]
          framework_id?: string
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          policy_status?: number
          risk_threshold?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "risk_framework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_agents: {
        Row: {
          agent_type: number
          created_at: string
          id: string
          org_id: string
          plan: number
          policy_id: string
          updated_at: string
        }
        Insert: {
          agent_type: number
          created_at?: string
          id?: string
          org_id: string
          plan: number
          policy_id: string
          updated_at?: string
        }
        Update: {
          agent_type?: number
          created_at?: string
          id?: string
          org_id?: string
          plan?: number
          policy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_agents_agent_type_fkey"
            columns: ["agent_type"]
            isOneToOne: false
            referencedRelation: "agent_catalog"
            referencedColumns: ["agent_type"]
          },
          {
            foreignKeyName: "policy_agents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_agents_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_agents_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_with_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_controls: {
        Row: {
          created_at: string
          id: string
          issue_type_control_id: string | null
          org_id: string
          policy_id: string
          remediation_control_id: string | null
          risk_framework_rule_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_type_control_id?: string | null
          org_id: string
          policy_id: string
          remediation_control_id?: string | null
          risk_framework_rule_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_type_control_id?: string | null
          org_id?: string
          policy_id?: string
          remediation_control_id?: string | null
          risk_framework_rule_id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_controls_issue_type_control_id_fkey"
            columns: ["issue_type_control_id"]
            isOneToOne: false
            referencedRelation: "issue_type_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_controls_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_controls_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_controls_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_with_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_controls_remediation_id_fkey"
            columns: ["remediation_control_id"]
            isOneToOne: false
            referencedRelation: "remediation_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_controls_risk_framework_rule_id_fkey"
            columns: ["risk_framework_rule_id"]
            isOneToOne: false
            referencedRelation: "risk_framework_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_mcp_servers: {
        Row: {
          created_at: string
          id: string
          mcp_server_type: number
          org_id: string
          policy_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mcp_server_type: number
          org_id: string
          policy_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mcp_server_type?: number
          org_id?: string
          policy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_mcp_servers_mcp_server_type_fkey"
            columns: ["mcp_server_type"]
            isOneToOne: false
            referencedRelation: "mcp_catalog"
            referencedColumns: ["mcp_server_type"]
          },
          {
            foreignKeyName: "policy_mcp_servers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_mcp_servers_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_mcp_servers_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_with_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_user_groups: {
        Row: {
          created_at: string
          id: string
          org_id: string
          policy_id: string
          updated_at: string
          user_group_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          policy_id: string
          updated_at?: string
          user_group_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          policy_id?: string
          updated_at?: string
          user_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_user_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_user_groups_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_user_groups_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_with_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_user_groups_user_group_id_fkey"
            columns: ["user_group_id"]
            isOneToOne: false
            referencedRelation: "active_user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_user_groups_user_group_id_fkey"
            columns: ["user_group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      prompt_injection_findings: {
        Row: {
          conversation_id: string
          conversation_storage: Json | null
          created_at: string
          customer_storage: Json | null
          description: string | null
          detected_at: string | null
          device_id: string | null
          finding_status: number
          id: string
          message_external_id: string
          metadata: Json | null
          org_id: string
          sandbox_id: string | null
          updated_at: string
        }
        Insert: {
          conversation_id: string
          conversation_storage?: Json | null
          created_at?: string
          customer_storage?: Json | null
          description?: string | null
          detected_at?: string | null
          device_id?: string | null
          finding_status?: number
          id?: string
          message_external_id: string
          metadata?: Json | null
          org_id: string
          sandbox_id?: string | null
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          conversation_storage?: Json | null
          created_at?: string
          customer_storage?: Json | null
          description?: string | null
          detected_at?: string | null
          device_id?: string | null
          finding_status?: number
          id?: string
          message_external_id?: string
          metadata?: Json | null
          org_id?: string
          sandbox_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_injection_findings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_injection_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "prompt_injection_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_injection_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "prompt_injection_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "prompt_injection_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_injection_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "prompt_injection_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_injection_findings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_injection_findings_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_injection_findings_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      remediation_controls: {
        Row: {
          configuration: Json | null
          created_at: string
          id: string
          metadata: Json | null
          org_id: string
          remediation_id: string
          updated_at: string
        }
        Insert: {
          configuration?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id: string
          remediation_id: string
          updated_at?: string
        }
        Update: {
          configuration?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          remediation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remediation_controls_remediation_id_fkey"
            columns: ["remediation_id"]
            isOneToOne: false
            referencedRelation: "remediations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      remediations: {
        Row: {
          created_at: string
          description: string | null
          enforcement_level: number | null
          id: string
          is_enforcement: boolean
          name: string
          remediation_type: number
          scope: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enforcement_level?: number | null
          id?: string
          is_enforcement: boolean
          name: string
          remediation_type: number
          scope: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enforcement_level?: number | null
          id?: string
          is_enforcement?: boolean
          name?: string
          remediation_type?: number
          scope?: number
          updated_at?: string
        }
        Relationships: []
      }
      risk_categories: {
        Row: {
          category_type: number
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_type?: number
          created_at?: string
          description?: string | null
          display_order: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category_type?: number
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      risk_framework: {
        Row: {
          created_at: string
          description: string | null
          entity_type: number | null
          id: string
          is_custom: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_type?: number | null
          id?: string
          is_custom?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_type?: number | null
          id?: string
          is_custom?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_framework_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_framework_imports: {
        Row: {
          catalog_rules: Json
          created_at: string
          framework_id: string
          mappings: Json
          policy_id: string | null
          source_file_name: string
          updated_at: string
        }
        Insert: {
          catalog_rules?: Json
          created_at?: string
          framework_id: string
          mappings?: Json
          policy_id?: string | null
          source_file_name: string
          updated_at?: string
        }
        Update: {
          catalog_rules?: Json
          created_at?: string
          framework_id?: string
          mappings?: Json
          policy_id?: string | null
          source_file_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_framework_imports_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: true
            referencedRelation: "risk_framework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_framework_imports_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_framework_imports_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_with_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_framework_rules: {
        Row: {
          created_at: string
          framework_id: string
          id: string
          org_id: string | null
          risk_rule_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          framework_id: string
          id?: string
          org_id?: string | null
          risk_rule_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          framework_id?: string
          id?: string
          org_id?: string | null
          risk_rule_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_risk_framework_rules_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "risk_framework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_framework_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_framework_rules_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "risk_framework_rules_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "risk_framework_rules_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "risk_framework_rules_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "risk_framework_rules_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_rule_aggression_mapping: {
        Row: {
          aggression_level: number
          created_at: string
          id: string
          issue_type_id: string
          risk_rule_id: string
          updated_at: string
        }
        Insert: {
          aggression_level: number
          created_at?: string
          id?: string
          issue_type_id: string
          risk_rule_id: string
          updated_at?: string
        }
        Update: {
          aggression_level?: number
          created_at?: string
          id?: string
          issue_type_id?: string
          risk_rule_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_rule_aggression_mapping_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "issue_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_rule_aggression_mapping_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "risk_rule_aggression_mapping_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "risk_rule_aggression_mapping_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "risk_rule_aggression_mapping_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "risk_rule_aggression_mapping_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_rule_control_mappings: {
        Row: {
          category_id: string
          control_mapping: string
          created_at: string
          id: string
          risk_rule_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          control_mapping: string
          created_at?: string
          id?: string
          risk_rule_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          control_mapping?: string
          created_at?: string
          id?: string
          risk_rule_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_rule_control_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "risk_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_rule_control_mappings_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "risk_rule_control_mappings_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "agent_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "risk_rule_control_mappings_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_by_risk_rule"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "risk_rule_control_mappings_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_issues_risk_rules"
            referencedColumns: ["risk_rule_id"]
          },
          {
            foreignKeyName: "risk_rule_control_mappings_risk_rule_id_fkey"
            columns: ["risk_rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_rules: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          display_order: number
          entity_type: number
          id: string
          implementation_status: number
          name: string
          risk_rule_type: number
          scoring_criteria: string | null
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          display_order: number
          entity_type: number
          id?: string
          implementation_status?: number
          name: string
          risk_rule_type: number
          scoring_criteria?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          entity_type?: number
          id?: string
          implementation_status?: number
          name?: string
          risk_rule_type?: number
          scoring_criteria?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "risk_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sandboxes: {
        Row: {
          account_metadata: Json | null
          created_at: string
          deleted_at: string | null
          friendly_name: string | null
          id: string
          last_seen_at: string
          org_id: string
          os_version: string | null
          parent_device_id: string
          runtime_type: number
          sandbox_native_id: string
          updated_at: string
          workspace_folder: string | null
        }
        Insert: {
          account_metadata?: Json | null
          created_at?: string
          deleted_at?: string | null
          friendly_name?: string | null
          id?: string
          last_seen_at?: string
          org_id: string
          os_version?: string | null
          parent_device_id: string
          runtime_type: number
          sandbox_native_id: string
          updated_at?: string
          workspace_folder?: string | null
        }
        Update: {
          account_metadata?: Json | null
          created_at?: string
          deleted_at?: string | null
          friendly_name?: string | null
          id?: string
          last_seen_at?: string
          org_id?: string
          os_version?: string | null
          parent_device_id?: string
          runtime_type?: number
          sandbox_native_id?: string
          updated_at?: string
          workspace_folder?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sandboxes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_reports: {
        Row: {
          created_at: string
          file_name: string
          id: string
          org_id: string
          source_name: string
          storage_path: string
          test_file: string | null
          tools_file: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          org_id: string
          source_name: string
          storage_path: string
          test_file?: string | null
          tools_file?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          org_id?: string
          source_name?: string
          storage_path?: string
          test_file?: string | null
          tools_file?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      sensitive_data_findings: {
        Row: {
          archive_inner_path: string | null
          category: number
          conversation_id: string
          conversation_storage: Json | null
          created_at: string
          customer_storage: Json | null
          device_id: string | null
          encoding_type: string | null
          end_line: number
          end_offset: number
          file_id: string | null
          finding_status: number
          id: string
          message_external_id: string
          message_timestamp: string | null
          metadata: Json | null
          org_id: string
          part_index: number
          rule_id: string
          sandbox_id: string | null
          start_line: number
          start_offset: number
          type: number
          updated_at: string
        }
        Insert: {
          archive_inner_path?: string | null
          category: number
          conversation_id: string
          conversation_storage?: Json | null
          created_at?: string
          customer_storage?: Json | null
          device_id?: string | null
          encoding_type?: string | null
          end_line: number
          end_offset: number
          file_id?: string | null
          finding_status?: number
          id?: string
          message_external_id: string
          message_timestamp?: string | null
          metadata?: Json | null
          org_id: string
          part_index?: number
          rule_id: string
          sandbox_id?: string | null
          start_line: number
          start_offset: number
          type: number
          updated_at?: string
        }
        Update: {
          archive_inner_path?: string | null
          category?: number
          conversation_id?: string
          conversation_storage?: Json | null
          created_at?: string
          customer_storage?: Json | null
          device_id?: string | null
          encoding_type?: string | null
          end_line?: number
          end_offset?: number
          file_id?: string | null
          finding_status?: number
          id?: string
          message_external_id?: string
          message_timestamp?: string | null
          metadata?: Json | null
          org_id?: string
          part_index?: number
          rule_id?: string
          sandbox_id?: string | null
          start_line?: number
          start_offset?: number
          type?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensitive_data_findings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensitive_data_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sensitive_data_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensitive_data_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sensitive_data_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sensitive_data_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensitive_data_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sensitive_data_findings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensitive_data_findings_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "agent_conversation_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensitive_data_findings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensitive_data_findings_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensitive_data_findings_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_installations: {
        Row: {
          access_token_secret_arn: string
          app_id: string
          authed_user_id: string | null
          bot_user_id: string | null
          created_at: string
          enterprise_id: string | null
          id: string
          integration_id: string | null
          is_enterprise_install: boolean
          org_id: string
          scopes: Json
          team_id: string
          updated_at: string
        }
        Insert: {
          access_token_secret_arn: string
          app_id: string
          authed_user_id?: string | null
          bot_user_id?: string | null
          created_at?: string
          enterprise_id?: string | null
          id?: string
          integration_id?: string | null
          is_enterprise_install?: boolean
          org_id: string
          scopes?: Json
          team_id: string
          updated_at?: string
        }
        Update: {
          access_token_secret_arn?: string
          app_id?: string
          authed_user_id?: string | null
          bot_user_id?: string | null
          created_at?: string
          enterprise_id?: string | null
          id?: string
          integration_id?: string | null
          is_enterprise_install?: boolean
          org_id?: string
          scopes?: Json
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slack_installations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slack_installations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      source_apps: {
        Row: {
          created_at: string
          hosting_environment_id: string
          id: string
          metadata: Json
          name: string
          org_id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hosting_environment_id: string
          id?: string
          metadata?: Json
          name: string
          org_id: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hosting_environment_id?: string
          id?: string
          metadata?: Json
          name?: string
          org_id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_apps_hosting_environment_id_fkey"
            columns: ["hosting_environment_id"]
            isOneToOne: false
            referencedRelation: "hosting_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_apps_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      source_apps_datalakes: {
        Row: {
          created_at: string
          datalake_id: string
          hosting_environment_id: string
          id: string
          org_id: string
          pod_id: string | null
          source_app_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          datalake_id: string
          hosting_environment_id: string
          id?: string
          org_id: string
          pod_id?: string | null
          source_app_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          datalake_id?: string
          hosting_environment_id?: string
          id?: string
          org_id?: string
          pod_id?: string | null
          source_app_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_apps_datalakes_datalake_id_fkey"
            columns: ["datalake_id"]
            isOneToOne: false
            referencedRelation: "datalakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_apps_datalakes_hosting_environment_id_fkey"
            columns: ["hosting_environment_id"]
            isOneToOne: false
            referencedRelation: "hosting_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_apps_datalakes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_apps_datalakes_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pod_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_apps_datalakes_source_app_id_fkey"
            columns: ["source_app_id"]
            isOneToOne: false
            referencedRelation: "source_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_state: {
        Row: {
          created_at: string
          id: string
          table_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          table_name: string
        }
        Update: {
          created_at?: string
          id?: string
          table_name?: string
        }
        Relationships: []
      }
      user_group_devices: {
        Row: {
          created_at: string
          device_id: string
          id: string
          org_id: string
          updated_at: string
          user_group_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          org_id: string
          updated_at?: string
          user_group_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          org_id?: string
          updated_at?: string
          user_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_devices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "user_group_devices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_devices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "user_group_devices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "user_group_devices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_devices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "user_group_devices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_devices_user_group_id_fkey"
            columns: ["user_group_id"]
            isOneToOne: false
            referencedRelation: "active_user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_devices_user_group_id_fkey"
            columns: ["user_group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_group_members: {
        Row: {
          created_at: string
          deleted_at: string | null
          external_updated_at: string | null
          external_user_id: string | null
          id: string
          idp_directory_user_id: string | null
          last_seen_at: string | null
          member_email: string
          org_id: string
          state: number
          updated_at: string
          user_group_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          external_updated_at?: string | null
          external_user_id?: string | null
          id?: string
          idp_directory_user_id?: string | null
          last_seen_at?: string | null
          member_email: string
          org_id: string
          state?: number
          updated_at?: string
          user_group_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          external_updated_at?: string | null
          external_user_id?: string | null
          id?: string
          idp_directory_user_id?: string | null
          last_seen_at?: string | null
          member_email?: string
          org_id?: string
          state?: number
          updated_at?: string
          user_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_members_directory_user_fkey"
            columns: ["idp_directory_user_id"]
            isOneToOne: false
            referencedRelation: "active_idp_directory_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_members_directory_user_fkey"
            columns: ["idp_directory_user_id"]
            isOneToOne: false
            referencedRelation: "idp_directory_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_members_group_fkey"
            columns: ["user_group_id"]
            isOneToOne: false
            referencedRelation: "active_user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_members_group_fkey"
            columns: ["user_group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups: {
        Row: {
          created_at: string
          deleted_at: string | null
          external_id: string | null
          external_idp_id: string | null
          external_updated_at: string | null
          id: string
          idp_integration_id: string | null
          last_modified_at: string | null
          last_seen_at: string | null
          name: string
          org_id: string
          updated_at: string
          user_group_source: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          external_id?: string | null
          external_idp_id?: string | null
          external_updated_at?: string | null
          id?: string
          idp_integration_id?: string | null
          last_modified_at?: string | null
          last_seen_at?: string | null
          name: string
          org_id: string
          updated_at?: string
          user_group_source: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          external_id?: string | null
          external_idp_id?: string | null
          external_updated_at?: string | null
          id?: string
          idp_integration_id?: string | null
          last_modified_at?: string | null
          last_seen_at?: string | null
          name?: string
          org_id?: string
          updated_at?: string
          user_group_source?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_groups_idp_integration_id_fkey"
            columns: ["idp_integration_id"]
            isOneToOne: false
            referencedRelation: "idp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          entitlement: string | null
          id: string
          org_id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entitlement?: string | null
          id: string
          org_id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entitlement?: string | null
          id?: string
          org_id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      vuln_baseline_findings: {
        Row: {
          advisory_id: string | null
          advisory_published: boolean
          created_at: string
          id: string
          location: Json | null
          mcp_catalog_id: string
          mcp_tool_input: Json | null
          mcp_tool_name: string
          message: string | null
          report_id: string
          rule_id: string
          severity: string
          updated_at: string
        }
        Insert: {
          advisory_id?: string | null
          advisory_published?: boolean
          created_at?: string
          id?: string
          location?: Json | null
          mcp_catalog_id: string
          mcp_tool_input?: Json | null
          mcp_tool_name: string
          message?: string | null
          report_id: string
          rule_id: string
          severity: string
          updated_at?: string
        }
        Update: {
          advisory_id?: string | null
          advisory_published?: boolean
          created_at?: string
          id?: string
          location?: Json | null
          mcp_catalog_id?: string
          mcp_tool_input?: Json | null
          mcp_tool_name?: string
          message?: string | null
          report_id?: string
          rule_id?: string
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "findings_mcp_catalog_id_fkey"
            columns: ["mcp_catalog_id"]
            isOneToOne: false
            referencedRelation: "mcp_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "vuln_baseline_scan_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "vuln_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      vuln_baseline_scan_reports: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mcp_catalog_id: string
          mcp_commit_sha: string | null
          source_name: string
          storage_path: string
          test_file: string | null
          tools_file: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mcp_catalog_id: string
          mcp_commit_sha?: string | null
          source_name: string
          storage_path: string
          test_file?: string | null
          tools_file?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mcp_catalog_id?: string
          mcp_commit_sha?: string | null
          source_name?: string
          storage_path?: string
          test_file?: string | null
          tools_file?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vuln_baseline_scan_reports_mcp_catalog_id_fkey"
            columns: ["mcp_catalog_id"]
            isOneToOne: false
            referencedRelation: "mcp_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      vuln_evidence: {
        Row: {
          attempt_number: number | null
          corpus_entry_id: string | null
          created_at: string
          error_message: string | null
          finding_id: string
          id: string
          known_cve_id: string | null
          payload_storage_path: string
          replay_duration_ms: number | null
          replay_script_storage_path: string
          response_storage_path: string
          sandbox_image_digest: string
          sandbox_log_storage_path: string | null
          scan_id_token: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt_number?: number | null
          corpus_entry_id?: string | null
          created_at?: string
          error_message?: string | null
          finding_id: string
          id?: string
          known_cve_id?: string | null
          payload_storage_path: string
          replay_duration_ms?: number | null
          replay_script_storage_path: string
          response_storage_path: string
          sandbox_image_digest: string
          sandbox_log_storage_path?: string | null
          scan_id_token: string
          status: string
          updated_at?: string
        }
        Update: {
          attempt_number?: number | null
          corpus_entry_id?: string | null
          created_at?: string
          error_message?: string | null
          finding_id?: string
          id?: string
          known_cve_id?: string | null
          payload_storage_path?: string
          replay_duration_ms?: number | null
          replay_script_storage_path?: string
          response_storage_path?: string
          sandbox_image_digest?: string
          sandbox_log_storage_path?: string | null
          scan_id_token?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vuln_evidence_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "vuln_baseline_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      vuln_evidence_canary_events: {
        Row: {
          canary_event_storage_path: string
          created_at: string
          evidence_id: string | null
          id: string
          occurred_at: string
          oracle_type: string
          scan_id_token: string
          time_to_fire_ms: number | null
        }
        Insert: {
          canary_event_storage_path: string
          created_at?: string
          evidence_id?: string | null
          id?: string
          occurred_at?: string
          oracle_type: string
          scan_id_token: string
          time_to_fire_ms?: number | null
        }
        Update: {
          canary_event_storage_path?: string
          created_at?: string
          evidence_id?: string | null
          id?: string
          occurred_at?: string
          oracle_type?: string
          scan_id_token?: string
          time_to_fire_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vuln_evidence_canary_events_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "vuln_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      vuln_rules: {
        Row: {
          case_id: string
          category_id: string
          category_name: string | null
          created_at: string
          description: string | null
          id: string
          updated_at: string
          vulnerability_type: string | null
        }
        Insert: {
          case_id: string
          category_id: string
          category_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          vulnerability_type?: string | null
        }
        Update: {
          case_id?: string
          category_id?: string
          category_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          vulnerability_type?: string | null
        }
        Relationships: []
      }
      workflows: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          schedule: string | null
          steps: Json
          trigger_type: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          schedule?: string | null
          steps?: Json
          trigger_type: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          schedule?: string | null
          steps?: Json
          trigger_type?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_agent_accounts: {
        Row: {
          agent_email: string | null
          agent_id: string | null
          agent_org_id: string | null
          agent_type: number | null
          created_at: string | null
          deleted_at: string | null
          device_id: string | null
          id: string | null
          last_active_at: string | null
          last_seen_at: string | null
          metadata: Json | null
          models_configuration: Json | null
          org_id: string | null
          plan: number | null
          sandbox_id: string | null
          security_settings: Json | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          agent_email?: string | null
          agent_id?: string | null
          agent_org_id?: string | null
          agent_type?: number | null
          created_at?: string | null
          deleted_at?: string | null
          device_id?: string | null
          id?: string | null
          last_active_at?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          models_configuration?: Json | null
          org_id?: string | null
          plan?: number | null
          sandbox_id?: string | null
          security_settings?: Json | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_email?: string | null
          agent_id?: string | null
          agent_org_id?: string | null
          agent_type?: number | null
          created_at?: string | null
          deleted_at?: string | null
          device_id?: string | null
          id?: string | null
          last_active_at?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          models_configuration?: Json | null
          org_id?: string | null
          plan?: number | null
          sandbox_id?: string | null
          security_settings?: Json | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_accounts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "active_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "mcp_connected_agents_summary"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_accounts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_with_agents"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_accounts_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      active_agent_devices: {
        Row: {
          agent_type: number | null
          device_id: string | null
          device_last_seen: string | null
          device_name: string | null
          device_native_id: string | null
          org_id: string | null
          os_version: string | null
          owner_email: string | null
          owner_name: string | null
          plan: number | null
          platform: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      active_agent_instances: {
        Row: {
          agent_catalog_id: string | null
          agent_deployment: number | null
          agent_type: number | null
          configuration: Json | null
          created_at: string | null
          deleted_at: string | null
          device_id: string | null
          id: string | null
          installations: Json | null
          last_active_at: string | null
          last_seen_at: string | null
          metadata: Json | null
          org_id: string | null
          sandbox_id: string | null
          tenant: string | null
          updated_at: string | null
        }
        Insert: {
          agent_catalog_id?: string | null
          agent_deployment?: number | null
          agent_type?: number | null
          configuration?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          device_id?: string | null
          id?: string | null
          installations?: Json | null
          last_active_at?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          org_id?: string | null
          sandbox_id?: string | null
          tenant?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_catalog_id?: string | null
          agent_deployment?: number | null
          agent_type?: number | null
          configuration?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          device_id?: string | null
          id?: string | null
          installations?: Json | null
          last_active_at?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          org_id?: string | null
          sandbox_id?: string | null
          tenant?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_instances_agent_catalog_id_fkey"
            columns: ["agent_catalog_id"]
            isOneToOne: false
            referencedRelation: "agent_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      active_agent_instances_accounts: {
        Row: {
          agent_account_id: string | null
          agent_instance_id: string | null
          created_at: string | null
          device_id: string | null
          id: string | null
          org_id: string | null
          sandbox_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_instances_accounts_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "active_agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "active_agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_instances_accounts_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      active_agents: {
        Row: {
          active_issues: number | null
          active_users: number | null
          actual_score: number | null
          affected_devices: number | null
          agent_catalog_id: string | null
          agent_status: number | null
          agent_type: number | null
          base_score: number | null
          created_at: string | null
          deleted_at: string | null
          deployment_types: number[] | null
          first_seen_at: string | null
          has_host_instances: boolean | null
          id: string | null
          instance_count: number | null
          last_active_at: string | null
          last_reviewed: string | null
          org_id: string | null
          plan: number | null
          sandbox_runtime_types: number[] | null
          total_incidents: number | null
          updated_at: string | null
        }
        Insert: {
          active_issues?: number | null
          active_users?: number | null
          actual_score?: number | null
          affected_devices?: number | null
          agent_catalog_id?: string | null
          agent_status?: number | null
          agent_type?: number | null
          base_score?: number | null
          created_at?: string | null
          deleted_at?: string | null
          deployment_types?: number[] | null
          first_seen_at?: string | null
          has_host_instances?: boolean | null
          id?: string | null
          instance_count?: number | null
          last_active_at?: string | null
          last_reviewed?: string | null
          org_id?: string | null
          plan?: number | null
          sandbox_runtime_types?: number[] | null
          total_incidents?: number | null
          updated_at?: string | null
        }
        Update: {
          active_issues?: number | null
          active_users?: number | null
          actual_score?: number | null
          affected_devices?: number | null
          agent_catalog_id?: string | null
          agent_status?: number | null
          agent_type?: number | null
          base_score?: number | null
          created_at?: string | null
          deleted_at?: string | null
          deployment_types?: number[] | null
          first_seen_at?: string | null
          has_host_instances?: boolean | null
          id?: string | null
          instance_count?: number | null
          last_active_at?: string | null
          last_reviewed?: string | null
          org_id?: string | null
          plan?: number | null
          sandbox_runtime_types?: number[] | null
          total_incidents?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_agent_catalog_id_fkey"
            columns: ["agent_catalog_id"]
            isOneToOne: false
            referencedRelation: "agent_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      active_devices: {
        Row: {
          account_metadata: Json | null
          architecture: string | null
          chip_model: string | null
          created_at: string | null
          deleted_at: string | null
          device_native_id: string | null
          device_uuid: string | null
          friendly_name: string | null
          id: string | null
          last_seen_at: string | null
          management_authorities: number[] | null
          org_id: string | null
          os_version: string | null
          platform: string | null
          updated_at: string | null
          windows_product_type: number | null
        }
        Insert: {
          account_metadata?: Json | null
          architecture?: string | null
          chip_model?: string | null
          created_at?: string | null
          deleted_at?: string | null
          device_native_id?: string | null
          device_uuid?: string | null
          friendly_name?: string | null
          id?: string | null
          last_seen_at?: string | null
          management_authorities?: number[] | null
          org_id?: string | null
          os_version?: string | null
          platform?: string | null
          updated_at?: string | null
          windows_product_type?: number | null
        }
        Update: {
          account_metadata?: Json | null
          architecture?: string | null
          chip_model?: string | null
          created_at?: string | null
          deleted_at?: string | null
          device_native_id?: string | null
          device_uuid?: string | null
          friendly_name?: string | null
          id?: string | null
          last_seen_at?: string | null
          management_authorities?: number[] | null
          org_id?: string | null
          os_version?: string | null
          platform?: string | null
          updated_at?: string | null
          windows_product_type?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      active_idp_directory_users: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          display_name: string | null
          email: string | null
          external_idp_id: string | null
          external_updated_at: string | null
          external_user_id: string | null
          first_name: string | null
          id: string | null
          idp_integration_id: string | null
          last_name: string | null
          last_seen_at: string | null
          org_id: string | null
          raw_attributes: Json | null
          state: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          external_idp_id?: string | null
          external_updated_at?: string | null
          external_user_id?: string | null
          first_name?: string | null
          id?: string | null
          idp_integration_id?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          org_id?: string | null
          raw_attributes?: Json | null
          state?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          external_idp_id?: string | null
          external_updated_at?: string | null
          external_user_id?: string | null
          first_name?: string | null
          id?: string | null
          idp_integration_id?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          org_id?: string | null
          raw_attributes?: Json | null
          state?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idp_directory_users_integration_fkey"
            columns: ["idp_integration_id"]
            isOneToOne: false
            referencedRelation: "idp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idp_directory_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      active_llm_model_devices: {
        Row: {
          device_id: string | null
          device_last_seen: string | null
          device_name: string | null
          device_native_id: string | null
          llm_model_type: number | null
          org_id: string | null
          os_version: string | null
          owner_email: string | null
          owner_name: string | null
          platform: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      active_llm_model_instances: {
        Row: {
          api_host: string | null
          created_at: string | null
          deleted_at: string | null
          device_id: string | null
          id: string | null
          last_seen_at: string | null
          llm_model_native_id: string | null
          llm_model_type: number | null
          org_id: string | null
          sandbox_id: string | null
          updated_at: string | null
        }
        Insert: {
          api_host?: string | null
          created_at?: string | null
          deleted_at?: string | null
          device_id?: string | null
          id?: string | null
          last_seen_at?: string | null
          llm_model_native_id?: string | null
          llm_model_type?: number | null
          org_id?: string | null
          sandbox_id?: string | null
          updated_at?: string | null
        }
        Update: {
          api_host?: string | null
          created_at?: string | null
          deleted_at?: string | null
          device_id?: string | null
          id?: string | null
          last_seen_at?: string | null
          llm_model_native_id?: string | null
          llm_model_type?: number | null
          org_id?: string | null
          sandbox_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "llm_model_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_model_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_model_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_model_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      active_mcp_devices: {
        Row: {
          device_id: string | null
          device_last_seen: string | null
          device_name: string | null
          device_native_id: string | null
          mcp_server_type: number | null
          org_id: string | null
          os_version: string | null
          owner_email: string | null
          owner_name: string | null
          platform: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      active_mcp_server_agent_instances: {
        Row: {
          agent_instance_id: string | null
          created_at: string | null
          device_id: string | null
          id: string | null
          mcp_server_instance_id: string | null
          org_id: string | null
          sandbox_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_agent_instances_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "active_agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_server_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_plans_expanded"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_with_agent_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_agent_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      active_mcp_server_instances: {
        Row: {
          agent_account_id: string | null
          agent_type: number | null
          auth_type: number | null
          created_at: string | null
          deleted_at: string | null
          deployment_model: number | null
          device_id: string | null
          distribution_channel: number | null
          id: string | null
          last_seen_at: string | null
          linked_plans: number[] | null
          mcp_native_id: string | null
          mcp_server_id: string | null
          mcp_server_location: string | null
          mcp_server_type: number | null
          metadata: Json | null
          org_id: string | null
          project_path: string | null
          sandbox_id: string | null
          security_findings: Json | null
          tools: Json | null
          transport_security_type: number | null
          transport_type: number | null
          updated_at: string | null
        }
        Insert: {
          agent_account_id?: string | null
          agent_type?: number | null
          auth_type?: number | null
          created_at?: string | null
          deleted_at?: string | null
          deployment_model?: number | null
          device_id?: string | null
          distribution_channel?: number | null
          id?: string | null
          last_seen_at?: string | null
          linked_plans?: number[] | null
          mcp_native_id?: string | null
          mcp_server_id?: string | null
          mcp_server_location?: string | null
          mcp_server_type?: number | null
          metadata?: Json | null
          org_id?: string | null
          project_path?: string | null
          sandbox_id?: string | null
          security_findings?: Json | null
          tools?: Json | null
          transport_security_type?: number | null
          transport_type?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_account_id?: string | null
          agent_type?: number | null
          auth_type?: number | null
          created_at?: string | null
          deleted_at?: string | null
          deployment_model?: number | null
          device_id?: string | null
          distribution_channel?: number | null
          id?: string | null
          last_seen_at?: string | null
          linked_plans?: number[] | null
          mcp_native_id?: string | null
          mcp_server_id?: string | null
          mcp_server_location?: string | null
          mcp_server_type?: number | null
          metadata?: Json | null
          org_id?: string | null
          project_path?: string | null
          sandbox_id?: string | null
          security_findings?: Json | null
          tools?: Json | null
          transport_security_type?: number | null
          transport_type?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_instances_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "active_agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      active_mcp_servers: {
        Row: {
          active_issues: number | null
          active_users: number | null
          actual_score: number | null
          affected_devices: number | null
          agent_names: Json | null
          auth_types: number[] | null
          base_score: number | null
          created_at: string | null
          deleted_at: string | null
          distribution_channels: number[] | null
          first_seen_at: string | null
          has_host_instances: boolean | null
          id: string | null
          instance_count: number | null
          last_reviewed: string | null
          mcp_catalog_id: string | null
          mcp_server_status: number | null
          mcp_server_type: number | null
          org_id: string | null
          sandbox_runtime_types: number[] | null
          total_incidents: number | null
          updated_at: string | null
        }
        Insert: {
          active_issues?: number | null
          active_users?: number | null
          actual_score?: number | null
          affected_devices?: number | null
          agent_names?: Json | null
          auth_types?: number[] | null
          base_score?: number | null
          created_at?: string | null
          deleted_at?: string | null
          distribution_channels?: number[] | null
          first_seen_at?: string | null
          has_host_instances?: boolean | null
          id?: string | null
          instance_count?: number | null
          last_reviewed?: string | null
          mcp_catalog_id?: string | null
          mcp_server_status?: number | null
          mcp_server_type?: number | null
          org_id?: string | null
          sandbox_runtime_types?: number[] | null
          total_incidents?: number | null
          updated_at?: string | null
        }
        Update: {
          active_issues?: number | null
          active_users?: number | null
          actual_score?: number | null
          affected_devices?: number | null
          agent_names?: Json | null
          auth_types?: number[] | null
          base_score?: number | null
          created_at?: string | null
          deleted_at?: string | null
          distribution_channels?: number[] | null
          first_seen_at?: string | null
          has_host_instances?: boolean | null
          id?: string | null
          instance_count?: number | null
          last_reviewed?: string | null
          mcp_catalog_id?: string | null
          mcp_server_status?: number | null
          mcp_server_type?: number | null
          org_id?: string | null
          sandbox_runtime_types?: number[] | null
          total_incidents?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_servers_mcp_catalog_id_fkey"
            columns: ["mcp_catalog_id"]
            isOneToOne: false
            referencedRelation: "mcp_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_servers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      active_sandboxes: {
        Row: {
          account_metadata: Json | null
          created_at: string | null
          deleted_at: string | null
          friendly_name: string | null
          id: string | null
          last_seen_at: string | null
          org_id: string | null
          os_version: string | null
          parent_device_id: string | null
          runtime_type: number | null
          sandbox_native_id: string | null
          updated_at: string | null
          workspace_folder: string | null
        }
        Insert: {
          account_metadata?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          friendly_name?: string | null
          id?: string | null
          last_seen_at?: string | null
          org_id?: string | null
          os_version?: string | null
          parent_device_id?: string | null
          runtime_type?: number | null
          sandbox_native_id?: string | null
          updated_at?: string | null
          workspace_folder?: string | null
        }
        Update: {
          account_metadata?: Json | null
          created_at?: string | null
          deleted_at?: string | null
          friendly_name?: string | null
          id?: string | null
          last_seen_at?: string | null
          org_id?: string | null
          os_version?: string | null
          parent_device_id?: string | null
          runtime_type?: number | null
          sandbox_native_id?: string | null
          updated_at?: string | null
          workspace_folder?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sandboxes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "sandboxes_parent_device_id_fkey"
            columns: ["parent_device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      active_user_group_members: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          external_updated_at: string | null
          external_user_id: string | null
          id: string | null
          idp_directory_user_id: string | null
          last_seen_at: string | null
          member_email: string | null
          org_id: string | null
          state: number | null
          updated_at: string | null
          user_group_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          external_updated_at?: string | null
          external_user_id?: string | null
          id?: string | null
          idp_directory_user_id?: string | null
          last_seen_at?: string | null
          member_email?: string | null
          org_id?: string | null
          state?: number | null
          updated_at?: string | null
          user_group_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          external_updated_at?: string | null
          external_user_id?: string | null
          id?: string | null
          idp_directory_user_id?: string | null
          last_seen_at?: string | null
          member_email?: string | null
          org_id?: string | null
          state?: number | null
          updated_at?: string | null
          user_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_group_members_directory_user_fkey"
            columns: ["idp_directory_user_id"]
            isOneToOne: false
            referencedRelation: "active_idp_directory_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_members_directory_user_fkey"
            columns: ["idp_directory_user_id"]
            isOneToOne: false
            referencedRelation: "idp_directory_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_members_group_fkey"
            columns: ["user_group_id"]
            isOneToOne: false
            referencedRelation: "active_user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_members_group_fkey"
            columns: ["user_group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      active_user_groups: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          external_id: string | null
          external_idp_id: string | null
          external_updated_at: string | null
          id: string | null
          idp_integration_id: string | null
          last_modified_at: string | null
          last_seen_at: string | null
          name: string | null
          org_id: string | null
          updated_at: string | null
          user_group_source: number | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          external_id?: string | null
          external_idp_id?: string | null
          external_updated_at?: string | null
          id?: string | null
          idp_integration_id?: string | null
          last_modified_at?: string | null
          last_seen_at?: string | null
          name?: string | null
          org_id?: string | null
          updated_at?: string | null
          user_group_source?: number | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          external_id?: string | null
          external_idp_id?: string | null
          external_updated_at?: string | null
          id?: string | null
          idp_integration_id?: string | null
          last_modified_at?: string | null
          last_seen_at?: string | null
          name?: string | null
          org_id?: string | null
          updated_at?: string | null
          user_group_source?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_groups_idp_integration_id_fkey"
            columns: ["idp_integration_id"]
            isOneToOne: false
            referencedRelation: "idp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_issues_by_risk_rule: {
        Row: {
          agent_type: number | null
          issue_status: number | null
          max_trigger_score: number | null
          org_id: string | null
          plan: number | null
          risk_rule_description: string | null
          risk_rule_id: string | null
          risk_rule_name: string | null
          total_issues: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_issues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_issues_risk_rules: {
        Row: {
          risk_rule_id: string | null
          risk_rule_name: string | null
        }
        Relationships: []
      }
      agent_issues_with_catalog: {
        Row: {
          agent_account_id: string | null
          agent_instance_id: string | null
          agent_name: string | null
          agent_type: number | null
          created_at: string | null
          device_id: string | null
          id: string | null
          issue_status: number | null
          issue_type_control_id: string | null
          last_seen_at: string | null
          metadata: Json | null
          org_id: string | null
          plan: number | null
          sandbox_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_issues_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "active_agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "active_agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "agent_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_issue_type_id_fkey"
            columns: ["issue_type_control_id"]
            isOneToOne: false
            referencedRelation: "issue_type_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_issues_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_mcp_servers_summary: {
        Row: {
          actual_score: number | null
          agent_type: number | null
          base_score: number | null
          category_name: string | null
          instance_count: number | null
          mcp_server_id: string | null
          mcp_server_name: string | null
          mcp_server_type: number | null
          org_id: string | null
          plan: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      devices_with_counts: {
        Row: {
          agent_count: number | null
          agent_issues: number | null
          chrome_extension_version: string | null
          created_at: string | null
          device_id: string | null
          device_native_id: string | null
          edge_extension_version: string | null
          friendly_name: string | null
          last_active: string | null
          llm_model_count: number | null
          mcp_count: number | null
          mcp_issues: number | null
          org_id: string | null
          os_version: string | null
          owner_email: string | null
          owner_name: string | null
          platform: string | null
          sandbox_count: number | null
          scout_version: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      devices_with_owners: {
        Row: {
          account_metadata: Json | null
          architecture: string | null
          chip_model: string | null
          created_at: string | null
          deleted_at: string | null
          device_native_id: string | null
          device_uuid: string | null
          friendly_name: string | null
          id: string | null
          last_seen_at: string | null
          org_id: string | null
          os_version: string | null
          owner_email: string | null
          owner_name: string | null
          platform: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_host_catalog_all: {
        Row: {
          created_at: string | null
          host_pattern: string | null
          id: string | null
          org_id: string | null
          provider: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          host_pattern?: string | null
          id?: string | null
          org_id?: never
          provider?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          host_pattern?: string | null
          id?: string | null
          org_id?: never
          provider?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      llm_model_catalog_all: {
        Row: {
          created_at: string | null
          description: string | null
          detection_patterns: string[] | null
          hosted_by: string[] | null
          id: string | null
          llm_model_type: number | null
          logo_url: string | null
          model_family: string | null
          model_name: string | null
          org_id: string | null
          origin_country: string | null
          publisher: string | null
          updated_at: string | null
          website: string | null
          weight: number | null
        }
        Relationships: []
      }
      mcp_catalog_all: {
        Row: {
          authentication_methods: number[] | null
          category_id: string | null
          description: string | null
          detection_patterns: Json | null
          execution_environment: number[] | null
          id: string | null
          logo_url: string | null
          mcp_server_name: string | null
          mcp_server_type: number | null
          org_id: string | null
          source_type: number | null
          website: string | null
        }
        Relationships: []
      }
      mcp_connected_agents_summary: {
        Row: {
          actual_score: number | null
          agent_id: string | null
          agent_name: string | null
          agent_type: number | null
          base_score: number | null
          instance_count: number | null
          mcp_server_id: string | null
          org_id: string | null
          plan: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_orphan_agents_summary: {
        Row: {
          agent_name: string | null
          agent_type: number | null
          instance_count: number | null
          mcp_server_id: string | null
          org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_instances_plans_expanded: {
        Row: {
          agent_account_id: string | null
          agent_type: number | null
          auth_type: number | null
          created_at: string | null
          deleted_at: string | null
          deployment_model: number | null
          device_id: string | null
          distribution_channel: number | null
          id: string | null
          last_seen_at: string | null
          linked_plans: number[] | null
          mcp_native_id: string | null
          mcp_server_id: string | null
          mcp_server_location: string | null
          mcp_server_type: number | null
          metadata: Json | null
          org_id: string | null
          plan: number | null
          project_path: string | null
          sandbox_id: string | null
          security_findings: Json | null
          tools: Json | null
          transport_security_type: number | null
          transport_type: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_instances_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "active_agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_instances_with_agent_catalog: {
        Row: {
          agent_account_id: string | null
          agent_name: string | null
          agent_type: number | null
          auth_type: number | null
          created_at: string | null
          deleted_at: string | null
          deployment_model: number | null
          device_id: string | null
          distribution_channel: number | null
          id: string | null
          last_seen_at: string | null
          linked_plans: number[] | null
          mcp_native_id: string | null
          mcp_server_id: string | null
          mcp_server_location: string | null
          mcp_server_type: number | null
          metadata: Json | null
          org_id: string | null
          project_path: string | null
          sandbox_id: string | null
          security_findings: Json | null
          tools: Json | null
          transport_security_type: number | null
          transport_type: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_instances_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "active_agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_instances_with_agents: {
        Row: {
          actual_score: number | null
          agent_account_id: string | null
          agent_id: string | null
          agent_name: string | null
          agent_type: number | null
          auth_type: number | null
          base_score: number | null
          created_at: string | null
          deleted_at: string | null
          deployment_model: number | null
          device_id: string | null
          distribution_channel: number | null
          id: string | null
          last_seen_at: string | null
          linked_plans: number[] | null
          mcp_native_id: string | null
          mcp_server_id: string | null
          mcp_server_location: string | null
          mcp_server_type: number | null
          metadata: Json | null
          org_id: string | null
          plan: number | null
          project_path: string | null
          sandbox_id: string | null
          security_findings: Json | null
          tools: Json | null
          transport_security_type: number | null
          transport_type: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_instances_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "active_agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_agent_account_id_fkey"
            columns: ["agent_account_id"]
            isOneToOne: false
            referencedRelation: "agent_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_instances_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_instances_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_issues_by_risk_rule: {
        Row: {
          issue_status: number | null
          max_trigger_score: number | null
          mcp_server_type: number | null
          org_id: string | null
          risk_rule_description: string | null
          risk_rule_id: string | null
          risk_rule_name: string | null
          total_issues: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_issues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_server_issues_risk_rules: {
        Row: {
          risk_rule_id: string | null
          risk_rule_name: string | null
        }
        Relationships: []
      }
      mcp_server_issues_with_catalog: {
        Row: {
          created_at: string | null
          device_id: string | null
          id: string | null
          issue_status: number | null
          issue_type_control_id: string | null
          last_seen_at: string | null
          mcp_server_instance_id: string | null
          mcp_server_name: string | null
          mcp_server_type: number | null
          metadata: Json | null
          org_id: string | null
          sandbox_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_agent_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_llm_model_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_counts"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "mcp_server_issues_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices_with_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_issue_type_id_fkey"
            columns: ["issue_type_control_id"]
            isOneToOne: false
            referencedRelation: "issue_type_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "active_mcp_server_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_plans_expanded"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_with_agent_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_mcp_server_instance_id_fkey"
            columns: ["mcp_server_instance_id"]
            isOneToOne: false
            referencedRelation: "mcp_server_instances_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "active_sandboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_server_issues_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      policies_with_metadata: {
        Row: {
          ai_access_config: Json | null
          assignment_type: number | null
          category: number | null
          created_at: string | null
          description: string | null
          employee_assignment_type: number | null
          exception_types: number[] | null
          framework_id: string | null
          has_incomplete_controls: boolean | null
          id: string | null
          is_default: boolean | null
          name: string | null
          org_id: string | null
          policy_status: number | null
          risk_threshold: number | null
          updated_at: string | null
        }
        Insert: {
          ai_access_config?: Json | null
          assignment_type?: number | null
          category?: number | null
          created_at?: string | null
          description?: string | null
          employee_assignment_type?: number | null
          exception_types?: number[] | null
          framework_id?: string | null
          has_incomplete_controls?: never
          id?: string | null
          is_default?: boolean | null
          name?: string | null
          org_id?: string | null
          policy_status?: number | null
          risk_threshold?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_access_config?: Json | null
          assignment_type?: number | null
          category?: number | null
          created_at?: string | null
          description?: string | null
          employee_assignment_type?: number | null
          exception_types?: number[] | null
          framework_id?: string | null
          has_incomplete_controls?: never
          id?: string | null
          is_default?: boolean | null
          name?: string | null
          org_id?: string | null
          policy_status?: number | null
          risk_threshold?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "risk_framework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_group_membership: {
        Row: {
          member_email: string | null
          org_id: string | null
          user_group_id: string | null
        }
        Relationships: []
      }
      user_group_resolved_devices: {
        Row: {
          device_id: string | null
          org_id: string | null
          user_group_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accessible_org_ids:
        | { Args: never; Returns: string[] }
        | { Args: { p_uid: string }; Returns: string[] }
      assign_user_to_org: {
        Args: { input_variable_email: string }
        Returns: {
          created_at: string
          id: string
          org_id: string
          role: string
          updated_at: string
        }[]
      }
      atomic_jsonb_delete_key: {
        Args: {
          field_name: string
          key_path: string[]
          record_id: string
          table_name: string
        }
        Returns: Json
      }
      atomic_jsonb_merge: {
        Args: {
          field_name: string
          merge_data: Json
          record_id: string
          table_name: string
        }
        Returns: Json
      }
      child_deletion_threshold: { Args: never; Returns: string }
      create_agent_policy: {
        Args: {
          p_agent_types: number[]
          p_aggression_level: number
          p_assignment_type: number
          p_category?: number
          p_description: string
          p_employee_assignment_type: number
          p_framework_id: string
          p_is_default?: boolean
          p_name: string
          p_org_id: string
          p_policy_status: number
          p_remediation_control_id?: string
          p_user_group_ids: string[]
        }
        Returns: string
      }
      create_ai_access_policy: {
        Args: {
          p_description: string
          p_employee_assignment_type: number
          p_name: string
          p_org_id: string
          p_user_group_ids?: string[]
        }
        Returns: string
      }
      create_mcp_policy: {
        Args: {
          p_aggression_level: number
          p_assignment_type: number
          p_category?: number
          p_description: string
          p_employee_assignment_type: number
          p_framework_id: string
          p_is_default?: boolean
          p_mcp_server_ids: string[]
          p_name: string
          p_org_id: string
          p_policy_status: number
          p_remediation_control_id?: string
          p_user_group_ids: string[]
        }
        Returns: string
      }
      create_org_with_conflict_handling: {
        Args: {
          org_description: string
          org_email_domain: string
          org_is_trial?: boolean
          org_name: string
        }
        Returns: {
          aws_iam_role_arn: string
          aws_iam_user_name: string
          aws_secret_name: string
          created_at: string
          description: string
          email_domain: string
          id: string
          name: string
          trial_expires_at: string
          updated_at: string
        }[]
      }
      create_user_group: {
        Args: {
          p_device_ids: string[]
          p_name: string
          p_org_id: string
          p_user_group_source?: number
        }
        Returns: string
      }
      create_user_profile_with_conflict_handling: {
        Args: { user_id: string; user_org_id: string; user_role: string }
        Returns: {
          created_at: string
          id: string
          org_id: string
          role: string
          updated_at: string
        }[]
      }
      current_user_org: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      device_deletion_threshold: { Args: never; Returns: string }
      device_id_for: {
        Args: {
          p_device_native_id: string
          p_device_uuid: string
          p_org_id: string
        }
        Returns: string
      }
      device_managed: {
        Args: {
          management_authorities: number[]
          platform: string
          windows_product_type: number
        }
        Returns: boolean
      }
      dismiss_agent_issues_with_policy_updates:
        | {
            Args: {
              p_dismissal_comment: string
              p_dismissal_reason: number
              p_issue_ids: string[]
              p_policy_control_updates?: Json
            }
            Returns: undefined
          }
        | {
            Args: {
              p_dismissal_comment: string
              p_dismissal_reason: number
              p_issue_ids: string[]
              p_org_id: string
              p_policy_control_updates?: Json
            }
            Returns: undefined
          }
      dismiss_mcp_issues_with_policy_updates:
        | {
            Args: {
              p_dismissal_comment: string
              p_dismissal_reason: number
              p_issue_ids: string[]
              p_policy_control_updates?: Json
            }
            Returns: undefined
          }
        | {
            Args: {
              p_dismissal_comment: string
              p_dismissal_reason: number
              p_issue_ids: string[]
              p_org_id: string
              p_policy_control_updates?: Json
            }
            Returns: undefined
          }
      get_active_agents_rollup: {
        Args: { p_org_ids?: string[] }
        Returns: {
          actual_score: number
          agent_catalog_id: string
          agent_name: string
          agent_type: number
          base_score: number
          deployment_types: number[]
          instance_count: number
          plan: number
        }[]
      }
      get_active_mcp_servers_rollup: {
        Args: { p_org_ids?: string[] }
        Returns: {
          actual_score: number
          auth_types: number[]
          base_score: number
          category_id: string
          category_name: string
          instance_count: number
          mcp_catalog_id: string
          mcp_server_name: string
          mcp_server_type: number
        }[]
      }
      get_agent_enforceable_policies_for_remediation_type:
        | {
            Args: {
              p_org_id: string
              p_remediation_type: number
              p_risk_rule_type: number
            }
            Returns: {
              has_remediation: boolean
              policy_id: string
              policy_name: string
              redact_audit_logs: boolean
            }[]
          }
        | {
            Args: { p_remediation_type: number; p_risk_rule_type: number }
            Returns: {
              has_remediation: boolean
              policy_id: string
              policy_name: string
            }[]
          }
      get_agent_issues_by_issue_type: {
        Args: {
          p_agent_types?: number[]
          p_org_id?: string
          p_plans?: number[]
          p_risk_rule_ids?: string[]
          p_status?: number
        }
        Returns: {
          affected_devices: Json
          applicable_to: number
          description: string
          display_order: number
          framework_id: string
          incident_count: number
          issue_detail: number
          issue_status: number
          issue_type_control_id: string
          last_seen_at: string
          name: string
          org_id: string
          remediation_text: string
          risk_framework_rule_id: string
          risk_rule_id: string
          risk_rule_name: string
          risk_rule_type: number
          trigger_score: number
        }[]
      }
      get_agent_issues_by_issue_type_rollup: {
        Args: {
          p_agent_types?: number[]
          p_org_ids?: string[]
          p_plans?: number[]
          p_risk_rule_ids?: string[]
          p_status?: number
        }
        Returns: {
          affected_devices: Json
          applicable_to: number
          incident_count: number
          last_seen_at: string
          name: string
          risk_rule_id: string
          risk_rule_name: string
          trigger_score: number
        }[]
      }
      get_agent_issues_metrics_summary:
        | {
            Args: {
              p_agent_types?: number[]
              p_plans?: number[]
              p_risk_rule_ids?: string[]
              p_status?: number
            }
            Returns: {
              affected_devices: number
              issues_count: number
              total_incidents: number
            }[]
          }
        | {
            Args: {
              p_agent_types?: number[]
              p_org_id: string
              p_plans?: number[]
              p_risk_rule_ids?: string[]
              p_status?: number
            }
            Returns: {
              affected_devices: number
              issues_count: number
              total_incidents: number
            }[]
          }
      get_agent_risk_framework_with_scores:
        | {
            Args: {
              p_agent_type: number
              p_framework_id: string
              p_plan: number
            }
            Returns: {
              actual_score: number
              baseline_rationale: string
              baseline_score: number
              category_display_order: number
              category_id: string
              category_name: string
              description: string
              framework_id: string
              framework_rule_id: string
              rule_display_order: number
              rule_id: string
              rule_name: string
              scoring_criteria: string
            }[]
          }
        | {
            Args: {
              p_agent_type: number
              p_framework_id: string
              p_org_id: string
              p_plan: number
            }
            Returns: {
              actual_score: number
              baseline_rationale: string
              baseline_score: number
              category_display_order: number
              category_id: string
              category_name: string
              description: string
              framework_id: string
              framework_rule_id: string
              rule_display_order: number
              rule_id: string
              rule_name: string
              scoring_criteria: string
            }[]
          }
      get_agent_selected_policies:
        | {
            Args: {
              p_agent_types: number[]
              p_org_id: string
              p_plans: number[]
            }
            Returns: {
              agent_type: number
              assignment_type: number
              category: number
              count: number
              created_at: string
              description: string
              is_default: boolean
              name: string
              org_id: string
              plan: number
              policy_id: string
              policy_status: number
              updated_at: string
            }[]
          }
        | {
            Args: {
              p_agent_types: number[]
              p_device_native_id: string
              p_device_uuid?: string
              p_org_id: string
              p_plans: number[]
            }
            Returns: {
              agent_type: number
              assignment_type: number
              category: number
              count: number
              created_at: string
              description: string
              is_default: boolean
              name: string
              org_id: string
              plan: number
              policy_id: string
              policy_status: number
              updated_at: string
            }[]
          }
      get_device_agent_issues_extended: {
        Args: { p_device_ids?: string[]; p_sandbox_ids?: string[] }
        Returns: {
          agent_account_id: string
          agent_email: string
          agent_name: string
          agent_type: number
          device_id: string
          device_native_id: string
          friendly_name: string
          issue_ids: string[]
          issue_status: number
          issue_type_control_id: string
          last_active_at: string
          last_seen_at: string
          metadata: Json
          owner_email: string
          plan: number
        }[]
      }
      get_device_agent_metadata: {
        Args: { p_device_ids?: string[]; p_sandbox_ids?: string[] }
        Returns: {
          agent_emails: string[]
          agent_type: number
          deployment_types: number[]
          device_id: string
          device_last_seen: string
          device_name: string
          device_native_id: string
          first_seen_at: string
          has_host_instances: boolean
          instance_count: number
          last_active_at: string
          org_id: string
          os_version: string
          owner_email: string
          owner_name: string
          plan: number
          platform: string
          sandbox_runtime_types: number[]
        }[]
      }
      get_device_mcp_metadata: {
        Args: { p_device_ids?: string[]; p_sandbox_ids?: string[] }
        Returns: {
          agent_names: string[]
          auth_types: number[]
          device_id: string
          distribution_channels: number[]
          first_seen_at: string
          has_host_instances: boolean
          instance_count: number
          mcp_server_type: number
          org_id: string
          sandbox_runtime_types: number[]
        }[]
      }
      get_device_mcp_server_issues_extended: {
        Args: { p_device_ids?: string[]; p_sandbox_ids?: string[] }
        Returns: {
          agent_email: string
          agent_name: string
          agent_type: number
          device_id: string
          device_native_id: string
          friendly_name: string
          issue_ids: string[]
          issue_status: number
          issue_type_control_id: string
          last_seen_at: string
          locations: Json
          mcp_native_id: string
          mcp_server_location: string
          mcp_server_name: string
          mcp_server_type: number
          metadata: Json
          owner_email: string
          plan: number
        }[]
      }
      get_earliest_conversation_timestamp: {
        Args: {
          p_device_native_id: string
          p_device_uuid?: string
          p_max_lookback_days?: number
          p_org_id: string
        }
        Returns: {
          agent_email: string
          agent_org_id: string
          agent_type: number
          earliest_timestamp: string
        }[]
      }
      get_effective_feature_flags: {
        Args: { p_org_id: string }
        Returns: {
          name: string
          value: Json
        }[]
      }
      get_enforcement_controls: {
        Args: {
          p_device_native_id: string
          p_device_uuid?: string
          p_org_id: string
        }
        Returns: {
          entity_key: string
          issue_detail: number
          remediation_type: number
          risk_rule_type: number
          settings: Json
        }[]
      }
      get_mcp_access_person_scopes: {
        Args: {
          p_mcp_server_types?: number[]
          p_org_id: string
          p_user_ids?: string[]
        }
        Returns: {
          decision_id: string
          group_id: string
          mcp_server_type: number
          user_id: string
          verdict: number
        }[]
      }
      get_mcp_access_status: {
        Args: {
          p_group_ids?: string[]
          p_mcp_server_types?: number[]
          p_org_id: string
        }
        Returns: {
          decision_id: string
          decision_scope: number
          group_id: string
          mcp_server_type: number
          policy_assignment_type: number
          policy_id: string
          verdict: number
        }[]
      }
      get_mcp_risk_framework_with_scores:
        | {
            Args: { p_framework_id: string; p_mcp_server_type: number }
            Returns: {
              actual_score: number
              baseline_rationale: string
              baseline_score: number
              category_display_order: number
              category_id: string
              category_name: string
              description: string
              framework_id: string
              framework_rule_id: string
              rule_display_order: number
              rule_id: string
              rule_name: string
              scoring_criteria: string
            }[]
          }
        | {
            Args: {
              p_framework_id: string
              p_mcp_server_type: number
              p_org_id: string
            }
            Returns: {
              actual_score: number
              baseline_rationale: string
              baseline_score: number
              category_display_order: number
              category_id: string
              category_name: string
              description: string
              framework_id: string
              framework_rule_id: string
              rule_display_order: number
              rule_id: string
              rule_name: string
              scoring_criteria: string
            }[]
          }
      get_mcp_selected_policies:
        | {
            Args: { p_mcp_server_types: number[]; p_org_id: string }
            Returns: {
              assignment_type: number
              category: number
              count: number
              created_at: string
              description: string
              is_default: boolean
              mcp_server_type: number
              name: string
              org_id: string
              policy_id: string
              policy_status: number
              updated_at: string
            }[]
          }
        | {
            Args: {
              p_device_native_id: string
              p_device_uuid?: string
              p_mcp_server_types: number[]
              p_org_id: string
            }
            Returns: {
              assignment_type: number
              category: number
              count: number
              created_at: string
              description: string
              is_default: boolean
              mcp_server_type: number
              name: string
              org_id: string
              policy_id: string
              policy_status: number
              updated_at: string
            }[]
          }
      get_mcp_server_issue_row_counts: {
        Args: {
          p_agent_types?: number[]
          p_device_ids?: string[]
          p_mcp_server_types?: number[]
          p_plans?: number[]
          p_status?: number
        }
        Returns: {
          issue_type_control_id: string
          row_count: number
        }[]
      }
      get_mcp_server_issues_by_issue_type: {
        Args: {
          p_agent_types?: number[]
          p_mcp_server_types?: number[]
          p_org_id?: string
          p_plans?: number[]
          p_risk_rule_ids?: string[]
          p_status?: number
        }
        Returns: {
          affected_devices: Json
          applicable_to: number
          description: string
          display_order: number
          framework_id: string
          incident_count: number
          issue_detail: number
          issue_status: number
          issue_type_control_id: string
          last_seen_at: string
          name: string
          org_id: string
          remediation_text: string
          risk_framework_rule_id: string
          risk_rule_id: string
          risk_rule_name: string
          risk_rule_type: number
          trigger_score: number
        }[]
      }
      get_mcp_server_issues_by_issue_type_rollup: {
        Args: {
          p_agent_types?: number[]
          p_mcp_server_types?: number[]
          p_org_ids?: string[]
          p_plans?: number[]
          p_risk_rule_ids?: string[]
          p_status?: number
        }
        Returns: {
          affected_devices: Json
          applicable_to: number
          incident_count: number
          last_seen_at: string
          name: string
          risk_rule_id: string
          risk_rule_name: string
          trigger_score: number
        }[]
      }
      get_mcp_server_issues_metrics_summary:
        | {
            Args: {
              p_agent_types?: number[]
              p_mcp_server_types?: number[]
              p_plans?: number[]
              p_risk_rule_ids?: string[]
              p_status?: number
            }
            Returns: {
              affected_devices: number
              issues_count: number
              total_incidents: number
            }[]
          }
        | {
            Args: {
              p_agent_types?: number[]
              p_mcp_server_types?: number[]
              p_org_id: string
              p_plans?: number[]
              p_risk_rule_ids?: string[]
              p_status?: number
            }
            Returns: {
              affected_devices: number
              issues_count: number
              total_incidents: number
            }[]
          }
      get_org_scorecard_rollup: {
        Args: { p_org_ids?: string[] }
        Returns: {
          agent_crit_types: number
          crit_types: number
          devices_any: number
          devices_crit_high: number
          email_domain: string
          high_types: number
          live_devices: number
          low_types: number
          mcp_crit_types: number
          med_types: number
          org_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      llm_resolve_model_selection: {
        Args: { p_org_id: string; p_selection: Json }
        Returns: Json
      }
      mark_child_entities_deleted: { Args: never; Returns: undefined }
      mark_devices_deleted: { Args: never; Returns: undefined }
      mark_sandboxes_deleted: { Args: never; Returns: undefined }
      mcp_server_instance_account: {
        Args: {
          p_agent_account_id: string
          p_instance_deleted: boolean
          p_mcp_server_instance_id: string
        }
        Returns: {
          agent_account_id: string
          agent_email: string
          plan: number
        }[]
      }
      merge_metadata: {
        Args: { merge_data: Json; record_id: string; table_name: string }
        Returns: Json
      }
      org_effective_domains: { Args: { p_org_id: string }; Returns: string[] }
      preview_sync_mcp_baseline_scores: {
        Args: never
        Returns: {
          affected_count: number
          max_updated_at: string
        }[]
      }
      preview_sync_mcp_baseline_scores_rows: {
        Args: { row_limit?: number }
        Returns: {
          applicable_to: number
          id: string
          name: string
          rationale: string
          rule_id: string
          score: number
          updated_at: string
        }[]
      }
      ra_subcategory_to_category: {
        Args: { subcategory: number }
        Returns: number
      }
      register_device_if_allowed: {
        Args: {
          p_device_native_id: string
          p_device_uuid?: string
          p_max_devices?: number
          p_org_id: string
        }
        Returns: undefined
      }
      reopen_agent_issues:
        | { Args: { p_issue_ids: string[] }; Returns: undefined }
        | {
            Args: { p_issue_ids: string[]; p_org_id: string }
            Returns: undefined
          }
      reopen_mcp_issues:
        | { Args: { p_issue_ids: string[] }; Returns: undefined }
        | {
            Args: { p_issue_ids: string[]; p_org_id: string }
            Returns: undefined
          }
      seed_default_ai_access_policy: {
        Args: { p_framework_id: string; p_org_id: string }
        Returns: string
      }
      seed_default_mcp_access_policy: {
        Args: { p_framework_id: string; p_org_id: string }
        Returns: string
      }
      set_policy_audit_redaction: {
        Args: {
          p_org_id: string
          p_redact_policy_ids: string[]
          p_risk_rule_type: number
          p_unredact_policy_ids: string[]
        }
        Returns: undefined
      }
      set_policy_otel_destination: {
        Args: {
          p_forward_agent_types?: number[]
          p_org_id: string
          p_otel_destination_ids?: string[]
          p_policy_id: string
        }
        Returns: string
      }
      set_policy_remediation_control:
        | {
            Args: {
              p_disable_policy_ids: string[]
              p_enable_policy_ids: string[]
              p_remediation_type: number
              p_risk_rule_type: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_disable_policy_ids: string[]
              p_enable_policy_ids: string[]
              p_org_id: string
              p_remediation_type: number
              p_risk_rule_type: number
            }
            Returns: undefined
          }
      sync_mcp_baseline_scores: {
        Args: never
        Returns: {
          max_updated_at: string
          synced_count: number
        }[]
      }
      update_agent_policy: {
        Args: {
          p_agent_types: number[]
          p_assignment_type: number
          p_employee_assignment_type: number
          p_org_id: string
          p_policy_id: string
          p_user_group_ids: string[]
        }
        Returns: string
      }
      update_agent_risk_scores_agg: { Args: never; Returns: undefined }
      update_agents_denormalized: { Args: never; Returns: undefined }
      update_customer_storage_config: {
        Args: { p_config: Json; p_id: string }
        Returns: {
          config: Json
          config_version: number
          created_at: string
          error_code: number
          id: string
          is_customer_error: boolean
          last_error: string
          last_validated_at: string
          provider: number
          status: number
          updated_at: string
        }[]
      }
      update_llm_models_denormalized: { Args: never; Returns: undefined }
      update_mcp_linked_plans: { Args: never; Returns: undefined }
      update_mcp_policy: {
        Args: {
          p_assignment_type: number
          p_employee_assignment_type: number
          p_mcp_server_types: number[]
          p_org_id: string
          p_policy_id: string
          p_user_group_ids: string[]
        }
        Returns: string
      }
      update_mcp_server_risk_scores_agg: { Args: never; Returns: undefined }
      update_mcp_servers_denormalized: { Args: never; Returns: undefined }
      update_mdm_credentials: {
        Args: { p_id: string }
        Returns: {
          created_at: string
          creds_version: number
          error_code: number
          id: string
          is_customer_error: boolean
          last_error: string
          last_synced: string
          provider: number
          status: number
          updated_at: string
        }[]
      }
      update_user_group: {
        Args: {
          p_device_ids: string[]
          p_name: string
          p_org_id: string
          p_user_group_id: string
        }
        Returns: undefined
      }
      upsert_device_component_version: {
        Args: {
          p_component: string
          p_device_native_id: string
          p_device_uuid?: string
          p_instance_id?: string
          p_org_id: string
          p_request_id: string
          p_version: string
        }
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
