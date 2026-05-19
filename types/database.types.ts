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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          empresa_id: string | null
          entidade: string
          entidade_id: string | null
          id: string
          motivo: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          empresa_id?: string | null
          entidade: string
          entidade_id?: string | null
          id?: string
          motivo?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          empresa_id?: string | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          motivo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      campos_extra: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          placeholder: string | null
          tipo_campo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          placeholder?: string | null
          tipo_campo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          placeholder?: string | null
          tipo_campo?: string
        }
        Relationships: []
      }
      campos_extra_opcoes: {
        Row: {
          ativo: boolean
          campo_id: string
          created_at: string
          id: string
          ordem: number
          valor: string
        }
        Insert: {
          ativo?: boolean
          campo_id: string
          created_at?: string
          id?: string
          ordem?: number
          valor: string
        }
        Update: {
          ativo?: boolean
          campo_id?: string
          created_at?: string
          id?: string
          ordem?: number
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "campos_extra_opcoes_campo_id_fkey"
            columns: ["campo_id"]
            isOneToOne: false
            referencedRelation: "campos_extra"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes: {
        Row: {
          ativo: boolean
          banco: string | null
          created_at: string
          dia_fechamento: number | null
          dia_vencimento: number
          empresa_id: string
          id: string
          nome: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          banco?: string | null
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento: number
          empresa_id: string
          id?: string
          nome: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          banco?: string | null
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number
          empresa_id?: string
          id?: string
          nome?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ciclos_faturamento: {
        Row: {
          ano: number
          cliente_id: string
          created_at: string
          data_envio_fatura: string | null
          data_fechamento: string | null
          data_vencimento: string | null
          empresa_id: string
          fatura_pdf_path: string | null
          id: string
          mes: number
          observacoes: string | null
          status: string
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          ano: number
          cliente_id: string
          created_at?: string
          data_envio_fatura?: string | null
          data_fechamento?: string | null
          data_vencimento?: string | null
          empresa_id: string
          fatura_pdf_path?: string | null
          id?: string
          mes: number
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          ano?: number
          cliente_id?: string
          created_at?: string
          data_envio_fatura?: string | null
          data_fechamento?: string | null
          data_vencimento?: string | null
          empresa_id?: string
          fatura_pdf_path?: string | null
          id?: string
          mes?: number
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ciclos_faturamento_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ciclos_faturamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cpf: string
          created_at: string
          crm_id: string | null
          data_nascimento: string | null
          dia_faturamento: number | null
          email: string
          empresa_id: string
          endereco: Json | null
          id: string
          nome: string
          observacoes: string | null
          origem: string | null
          status: string
          telefone: string
          tipo: string
          updated_at: string
        }
        Insert: {
          cpf: string
          created_at?: string
          crm_id?: string | null
          data_nascimento?: string | null
          dia_faturamento?: number | null
          email: string
          empresa_id: string
          endereco?: Json | null
          id?: string
          nome: string
          observacoes?: string | null
          origem?: string | null
          status?: string
          telefone: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          cpf?: string
          created_at?: string
          crm_id?: string | null
          data_nascimento?: string | null
          dia_faturamento?: number | null
          email?: string
          empresa_id?: string
          endereco?: Json | null
          id?: string
          nome?: string
          observacoes?: string | null
          origem?: string | null
          status?: string
          telefone?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_cliente: {
        Row: {
          created_at: string
          id: string
          observacoes: string | null
          valor_total: number
          venda_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          observacoes?: string | null
          valor_total: number
          venda_id: string
        }
        Update: {
          created_at?: string
          id?: string
          observacoes?: string | null
          valor_total?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_cliente_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: true
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_cliente_itens: {
        Row: {
          cobranca_id: string
          created_at: string
          data_inicio: string | null
          data_primeiro_recebimento: string | null
          fornecedor_destino: string | null
          id: string
          num_parcelas: number
          observacoes: string | null
          plataforma_link: string | null
          taxa_adquirente: number | null
          tipo: string
          valor_liquido: number | null
          valor_parcela: number | null
          valor_total: number
        }
        Insert: {
          cobranca_id: string
          created_at?: string
          data_inicio?: string | null
          data_primeiro_recebimento?: string | null
          fornecedor_destino?: string | null
          id?: string
          num_parcelas?: number
          observacoes?: string | null
          plataforma_link?: string | null
          taxa_adquirente?: number | null
          tipo: string
          valor_liquido?: number | null
          valor_parcela?: number | null
          valor_total: number
        }
        Update: {
          cobranca_id?: string
          created_at?: string
          data_inicio?: string | null
          data_primeiro_recebimento?: string | null
          fornecedor_destino?: string | null
          id?: string
          num_parcelas?: number
          observacoes?: string | null
          plataforma_link?: string | null
          taxa_adquirente?: number | null
          tipo?: string
          valor_liquido?: number | null
          valor_parcela?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_cliente_itens_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobranca_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          id: string
          nome: string
          slug: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
          slug: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
          slug?: string
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cnpj: string
          created_at: string
          id: string
          nome: string
          tipo: string | null
        }
        Insert: {
          ativo?: boolean
          cnpj: string
          created_at?: string
          id?: string
          nome: string
          tipo?: string | null
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          created_at?: string
          id?: string
          nome?: string
          tipo?: string | null
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          created_at: string
          empresa_id: string | null
          entidade: string | null
          entidade_id: string | null
          erro: string | null
          id: string
          integracao: string
          operacao: string
          payload: Json | null
          resposta: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          entidade?: string | null
          entidade_id?: string | null
          erro?: string | null
          id?: string
          integracao: string
          operacao: string
          payload?: Json | null
          resposta?: Json | null
          status: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          entidade?: string | null
          entidade_id?: string | null
          erro?: string | null
          id?: string
          integracao?: string
          operacao?: string
          payload?: Json | null
          resposta?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      lembretes: {
        Row: {
          created_at: string
          data_lembrete: string
          destinatario_id: string | null
          empresa_id: string | null
          id: string
          mensagem: string
          referencia_id: string | null
          referencia_tipo: string | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          data_lembrete: string
          destinatario_id?: string | null
          empresa_id?: string | null
          id?: string
          mensagem: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string
          tipo: string
        }
        Update: {
          created_at?: string
          data_lembrete?: string
          destinatario_id?: string | null
          empresa_id?: string | null
          id?: string
          mensagem?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lembretes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_pagar: {
        Row: {
          cartao_id: string | null
          created_at: string
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string | null
          empresa_id: string
          forma_pagamento: string | null
          fornecedor_id: string | null
          fornecedor_nome: string
          id: string
          numero: number
          observacoes: string | null
          status: string
          total_parcelas: number
          updated_at: string
          valor: number
          venda_produto_id: string | null
        }
        Insert: {
          cartao_id?: string | null
          created_at?: string
          data_emissao: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao?: string | null
          empresa_id: string
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          fornecedor_nome: string
          id?: string
          numero: number
          observacoes?: string | null
          status?: string
          total_parcelas: number
          updated_at?: string
          valor: number
          venda_produto_id?: string | null
        }
        Update: {
          cartao_id?: string | null
          created_at?: string
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string | null
          empresa_id?: string
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string
          id?: string
          numero?: number
          observacoes?: string | null
          status?: string
          total_parcelas?: number
          updated_at?: string
          valor?: number
          venda_produto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_pagar_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagar_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagar_venda_produto_id_fkey"
            columns: ["venda_produto_id"]
            isOneToOne: false
            referencedRelation: "venda_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_receber: {
        Row: {
          cliente_id: string | null
          cobranca_item_id: string | null
          created_at: string
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string | null
          empresa_id: string
          forma_pagamento: string | null
          id: string
          numero: number
          observacoes: string | null
          status: string
          total_parcelas: number
          updated_at: string
          valor: number
          venda_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          cobranca_item_id?: string | null
          created_at?: string
          data_emissao: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao?: string | null
          empresa_id: string
          forma_pagamento?: string | null
          id?: string
          numero: number
          observacoes?: string | null
          status?: string
          total_parcelas: number
          updated_at?: string
          valor: number
          venda_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          cobranca_item_id?: string | null
          created_at?: string
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string | null
          empresa_id?: string
          forma_pagamento?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          status?: string
          total_parcelas?: number
          updated_at?: string
          valor?: number
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_receber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_receber_cobranca_item_id_fkey"
            columns: ["cobranca_item_id"]
            isOneToOne: false
            referencedRelation: "cobranca_cliente_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_receber_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_receber_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_acesso: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          permissoes: Json
          sistema: boolean
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          permissoes?: Json
          sistema?: boolean
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          permissoes?: Json
          sistema?: boolean
        }
        Relationships: []
      }
      tipos_produto: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      tipos_produto_campos: {
        Row: {
          campo_id: string
          id: string
          obrigatorio: boolean
          ordem: number
          tipo_produto_id: string
        }
        Insert: {
          campo_id: string
          id?: string
          obrigatorio?: boolean
          ordem?: number
          tipo_produto_id: string
        }
        Update: {
          campo_id?: string
          id?: string
          obrigatorio?: boolean
          ordem?: number
          tipo_produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_produto_campos_campo_id_fkey"
            columns: ["campo_id"]
            isOneToOne: false
            referencedRelation: "campos_extra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tipos_produto_campos_tipo_produto_id_fkey"
            columns: ["tipo_produto_id"]
            isOneToOne: false
            referencedRelation: "tipos_produto"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean
          comissao_percentual: number | null
          created_at: string
          email: string
          empresa_id: string | null
          force_password_change: boolean
          id: string
          iniciais: string | null
          nome: string
          perfil_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          comissao_percentual?: number | null
          created_at?: string
          email: string
          empresa_id?: string | null
          force_password_change?: boolean
          id: string
          iniciais?: string | null
          nome: string
          perfil_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          comissao_percentual?: number | null
          created_at?: string
          email?: string
          empresa_id?: string | null
          force_password_change?: boolean
          id?: string
          iniciais?: string | null
          nome?: string
          perfil_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_passageiros: {
        Row: {
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          id: string
          nome: string
          ordem: number
          venda_id: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome: string
          ordem?: number
          venda_id: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome?: string
          ordem?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_passageiros_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_produto_passageiros: {
        Row: {
          id: string
          venda_passageiro_id: string
          venda_produto_id: string
        }
        Insert: {
          id?: string
          venda_passageiro_id: string
          venda_produto_id: string
        }
        Update: {
          id?: string
          venda_passageiro_id?: string
          venda_produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_produto_passageiros_venda_passageiro_id_fkey"
            columns: ["venda_passageiro_id"]
            isOneToOne: false
            referencedRelation: "venda_passageiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_produto_passageiros_venda_produto_id_fkey"
            columns: ["venda_produto_id"]
            isOneToOne: false
            referencedRelation: "venda_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_produtos: {
        Row: {
          comissao_vendedor: number | null
          created_at: string
          data_fim_viagem: string | null
          data_inicio_viagem: string | null
          destino: string | null
          fornecedor_id: string | null
          fornecedor_nome: string
          id: string
          localizador: string | null
          localizador_fornecedor: string | null
          ordem: number
          pgto_cartao_id: string | null
          pgto_data_debito: string | null
          pgto_entrada: number | null
          pgto_forma: string | null
          pgto_num_parcelas: number | null
          pgto_status: string
          pgto_valor_parcela: number | null
          pgto_valor_total: number | null
          rav: number | null
          rav_extra_cliente: number
          rav_extra_fornecedor: number
          tipo_comissao: string | null
          tipo_produto_id: string
          tipo_produto_nome: string
          valor_custo: number
          valor_venda: number
          valores_extras: Json
          venda_id: string
        }
        Insert: {
          comissao_vendedor?: number | null
          created_at?: string
          data_fim_viagem?: string | null
          data_inicio_viagem?: string | null
          destino?: string | null
          fornecedor_id?: string | null
          fornecedor_nome: string
          id?: string
          localizador?: string | null
          localizador_fornecedor?: string | null
          ordem?: number
          pgto_cartao_id?: string | null
          pgto_data_debito?: string | null
          pgto_entrada?: number | null
          pgto_forma?: string | null
          pgto_num_parcelas?: number | null
          pgto_status?: string
          pgto_valor_parcela?: number | null
          pgto_valor_total?: number | null
          rav?: number | null
          rav_extra_cliente?: number
          rav_extra_fornecedor?: number
          tipo_comissao?: string | null
          tipo_produto_id: string
          tipo_produto_nome: string
          valor_custo: number
          valor_venda: number
          valores_extras?: Json
          venda_id: string
        }
        Update: {
          comissao_vendedor?: number | null
          created_at?: string
          data_fim_viagem?: string | null
          data_inicio_viagem?: string | null
          destino?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string
          id?: string
          localizador?: string | null
          localizador_fornecedor?: string | null
          ordem?: number
          pgto_cartao_id?: string | null
          pgto_data_debito?: string | null
          pgto_entrada?: number | null
          pgto_forma?: string | null
          pgto_num_parcelas?: number | null
          pgto_status?: string
          pgto_valor_parcela?: number | null
          pgto_valor_total?: number | null
          rav?: number | null
          rav_extra_cliente?: number
          rav_extra_fornecedor?: number
          tipo_comissao?: string | null
          tipo_produto_id?: string
          tipo_produto_nome?: string
          valor_custo?: number
          valor_venda?: number
          valores_extras?: Json
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_venda_produtos_cartao"
            columns: ["pgto_cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_produtos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_produtos_tipo_produto_id_fkey"
            columns: ["tipo_produto_id"]
            isOneToOne: false
            referencedRelation: "tipos_produto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_produtos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          aprovado_por: string | null
          cancelado_por: string | null
          ciclo_faturamento_id: string | null
          cliente_id: string
          created_at: string
          data_aprovacao: string | null
          data_cancelamento: string | null
          data_venda: string
          empresa_id: string
          flag_marketing: boolean
          id: string
          indicacao_percentual: number | null
          motivo_devolucao: string | null
          observacoes: string | null
          origem: string | null
          pax: number
          status: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          aprovado_por?: string | null
          cancelado_por?: string | null
          ciclo_faturamento_id?: string | null
          cliente_id: string
          created_at?: string
          data_aprovacao?: string | null
          data_cancelamento?: string | null
          data_venda: string
          empresa_id: string
          flag_marketing?: boolean
          id?: string
          indicacao_percentual?: number | null
          motivo_devolucao?: string | null
          observacoes?: string | null
          origem?: string | null
          pax?: number
          status?: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          aprovado_por?: string | null
          cancelado_por?: string | null
          ciclo_faturamento_id?: string | null
          cliente_id?: string
          created_at?: string
          data_aprovacao?: string | null
          data_cancelamento?: string | null
          data_venda?: string
          empresa_id?: string
          flag_marketing?: boolean
          id?: string
          indicacao_percentual?: number | null
          motivo_devolucao?: string | null
          observacoes?: string | null
          origem?: string | null
          pax?: number
          status?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_ciclo_faturamento_id_fkey"
            columns: ["ciclo_faturamento_id"]
            isOneToOne: false
            referencedRelation: "ciclos_faturamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_user_empresa_id: { Args: never; Returns: string }
      app_user_perfil_nome: { Args: never; Returns: string }
      is_administrador: { Args: never; Returns: boolean }
      is_agente: { Args: never; Returns: boolean }
      is_gerente: { Args: never; Returns: boolean }
      mesma_empresa: { Args: { p_empresa_id: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
