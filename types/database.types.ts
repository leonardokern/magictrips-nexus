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
      agenda_eventos: {
        Row: {
          all_day: boolean
          cor: string
          created_at: string
          criado_por: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          empresa_id: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          cor?: string
          created_at?: string
          criado_por: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          empresa_id: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          cor?: string
          created_at?: string
          criado_por?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          empresa_id?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_eventos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_eventos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_eventos_compartilhamentos: {
        Row: {
          created_at: string
          evento_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          evento_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          evento_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_eventos_compartilhamentos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "agenda_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_eventos_compartilhamentos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
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
      caixas: {
        Row: {
          ativo: boolean
          created_at: string | null
          empresa_id: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "caixas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      categorias_financeiras: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          cnpj: string | null
          cpf: string | null
          created_at: string
          crm_id: string | null
          data_nascimento: string | null
          dia_faturamento: number | null
          email: string | null
          empresa_id: string
          endereco: Json | null
          estrangeiro: boolean
          id: string
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          origem: string | null
          passaporte: string | null
          razao_social: string | null
          responsavel: string | null
          status: string
          telefone: string
          telefone_ddi: string
          tipo: string
          tipo_pessoa: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          crm_id?: string | null
          data_nascimento?: string | null
          dia_faturamento?: number | null
          email?: string | null
          empresa_id: string
          endereco?: Json | null
          estrangeiro?: boolean
          id?: string
          nome: string
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: string | null
          passaporte?: string | null
          razao_social?: string | null
          responsavel?: string | null
          status?: string
          telefone: string
          telefone_ddi?: string
          tipo?: string
          tipo_pessoa?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          crm_id?: string | null
          data_nascimento?: string | null
          dia_faturamento?: number | null
          email?: string | null
          empresa_id?: string
          endereco?: Json | null
          estrangeiro?: boolean
          id?: string
          nome?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: string | null
          passaporte?: string | null
          razao_social?: string | null
          responsavel?: string | null
          status?: string
          telefone?: string
          telefone_ddi?: string
          tipo?: string
          tipo_pessoa?: string
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
          {
            foreignKeyName: "cobranca_cliente_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: true
            referencedRelation: "vendas_efetivas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_cliente_itens: {
        Row: {
          cobranca_id: string
          comprovante_mime_type: string | null
          comprovante_nome_arquivo: string | null
          comprovante_storage_path: string | null
          comprovante_tamanho_bytes: number | null
          created_at: string
          data_inicio: string | null
          data_primeiro_recebimento: string | null
          fornecedor_destino: string | null
          id: string
          num_parcelas: number
          observacoes: string | null
          parcelas_detalhe: Json
          plataforma: string | null
          plataforma_link: string | null
          taxa_adquirente: number | null
          taxa_cobranca: number
          tipo: string
          valor_liquido: number | null
          valor_parcela: number | null
          valor_total: number
        }
        Insert: {
          cobranca_id: string
          comprovante_mime_type?: string | null
          comprovante_nome_arquivo?: string | null
          comprovante_storage_path?: string | null
          comprovante_tamanho_bytes?: number | null
          created_at?: string
          data_inicio?: string | null
          data_primeiro_recebimento?: string | null
          fornecedor_destino?: string | null
          id?: string
          num_parcelas?: number
          observacoes?: string | null
          parcelas_detalhe?: Json
          plataforma?: string | null
          plataforma_link?: string | null
          taxa_adquirente?: number | null
          taxa_cobranca?: number
          tipo: string
          valor_liquido?: number | null
          valor_parcela?: number | null
          valor_total: number
        }
        Update: {
          cobranca_id?: string
          comprovante_mime_type?: string | null
          comprovante_nome_arquivo?: string | null
          comprovante_storage_path?: string | null
          comprovante_tamanho_bytes?: number | null
          created_at?: string
          data_inicio?: string | null
          data_primeiro_recebimento?: string | null
          fornecedor_destino?: string | null
          id?: string
          num_parcelas?: number
          observacoes?: string | null
          parcelas_detalhe?: Json
          plataforma?: string | null
          plataforma_link?: string | null
          taxa_adquirente?: number | null
          taxa_cobranca?: number
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
      comissoes_regras: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          observacao: string | null
          origem_id: string
          percentual: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          observacao?: string | null
          origem_id: string
          percentual: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          observacao?: string | null
          origem_id?: string
          percentual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_regras_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "origens_venda"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          banco_agencia: string | null
          banco_conta: string | null
          banco_nome: string | null
          cidade: string | null
          cnpj: string | null
          codigo_fatura: string | null
          cor_primaria: string | null
          cor_secundaria: string | null
          created_at: string
          id: string
          logo_path: string | null
          nome: string
          prefixo_identificador: string
          proximo_num_venda: number
          razao_social: string | null
          slug: string
        }
        Insert: {
          ativo?: boolean
          banco_agencia?: string | null
          banco_conta?: string | null
          banco_nome?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_fatura?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string
          id?: string
          logo_path?: string | null
          nome: string
          prefixo_identificador?: string
          proximo_num_venda?: number
          razao_social?: string | null
          slug: string
        }
        Update: {
          ativo?: boolean
          banco_agencia?: string | null
          banco_conta?: string | null
          banco_nome?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_fatura?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string
          id?: string
          logo_path?: string | null
          nome?: string
          prefixo_identificador?: string
          proximo_num_venda?: number
          razao_social?: string | null
          slug?: string
        }
        Relationships: []
      }
      fatura_parcelas: {
        Row: {
          fatura_id: string
          id: string
          parcela_id: string
        }
        Insert: {
          fatura_id: string
          id?: string
          parcela_id: string
        }
        Update: {
          fatura_id?: string
          id?: string
          parcela_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fatura_parcelas_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "faturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatura_parcelas_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcelas_receber"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas: {
        Row: {
          ano: number
          caixa_id: string | null
          cliente_id: string
          created_at: string
          data_emissao: string
          data_pagamento: string | null
          desconto_percentual: number
          desconto_valor: number
          empresa_id: string
          id: string
          juros_percentual: number
          juros_valor: number
          multa_percentual: number
          multa_valor: number
          numero: string
          numero_display: string
          numero_sequencial: number
          observacoes: string | null
          status: string
          updated_at: string
          valor_recebido: number | null
          valor_total: number
        }
        Insert: {
          ano: number
          caixa_id?: string | null
          cliente_id: string
          created_at?: string
          data_emissao?: string
          data_pagamento?: string | null
          desconto_percentual?: number
          desconto_valor?: number
          empresa_id: string
          id?: string
          juros_percentual?: number
          juros_valor?: number
          multa_percentual?: number
          multa_valor?: number
          numero: string
          numero_display: string
          numero_sequencial: number
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_recebido?: number | null
          valor_total: number
        }
        Update: {
          ano?: number
          caixa_id?: string | null
          cliente_id?: string
          created_at?: string
          data_emissao?: string
          data_pagamento?: string | null
          desconto_percentual?: number
          desconto_valor?: number
          empresa_id?: string
          id?: string
          juros_percentual?: number
          juros_valor?: number
          multa_percentual?: number
          multa_valor?: number
          numero?: string
          numero_display?: string
          numero_sequencial?: number
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_recebido?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturas_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          ativo: boolean
          ativo_dev: boolean
          ativo_prod: boolean
          chave: string
          descricao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          ativo_dev?: boolean
          ativo_prod?: boolean
          chave: string
          descricao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          ativo_dev?: boolean
          ativo_prod?: boolean
          chave?: string
          descricao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fornecedor_tipos_produto: {
        Row: {
          created_at: string
          fornecedor_id: string
          id: string
          tipo_produto_id: string
        }
        Insert: {
          created_at?: string
          fornecedor_id: string
          id?: string
          tipo_produto_id: string
        }
        Update: {
          created_at?: string
          fornecedor_id?: string
          id?: string
          tipo_produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedor_tipos_produto_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fornecedor_tipos_produto_tipo_produto_id_fkey"
            columns: ["tipo_produto_id"]
            isOneToOne: false
            referencedRelation: "tipos_produto"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cnpj: string
          created_at: string
          id: string
          modo_comissionado: boolean
          modo_comissionado_dia_pagamento: number | null
          modo_net: boolean
          nome: string
          tipo: string | null
        }
        Insert: {
          ativo?: boolean
          cnpj: string
          created_at?: string
          id?: string
          modo_comissionado?: boolean
          modo_comissionado_dia_pagamento?: number | null
          modo_net?: boolean
          nome: string
          tipo?: string | null
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          created_at?: string
          id?: string
          modo_comissionado?: boolean
          modo_comissionado_dia_pagamento?: number | null
          modo_net?: boolean
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
      lancamento_anexos: {
        Row: {
          created_at: string
          created_by: string
          empresa_id: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          parcela_pagar_id: string | null
          parcela_receber_id: string | null
          storage_path: string
          tamanho_bytes: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          empresa_id: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          parcela_pagar_id?: string | null
          parcela_receber_id?: string | null
          storage_path: string
          tamanho_bytes?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          empresa_id?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          parcela_pagar_id?: string | null
          parcela_receber_id?: string | null
          storage_path?: string
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamento_anexos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_anexos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_anexos_parcela_pagar_id_fkey"
            columns: ["parcela_pagar_id"]
            isOneToOne: false
            referencedRelation: "parcelas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_anexos_parcela_receber_id_fkey"
            columns: ["parcela_receber_id"]
            isOneToOne: false
            referencedRelation: "parcelas_receber"
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
      origens_venda: {
        Row: {
          ativo: boolean
          comissao_percentual: number | null
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          comissao_percentual?: number | null
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          comissao_percentual?: number | null
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      pacote_item_fornecedores: {
        Row: {
          fornecedor_id: string
          id: string
          ordem: number
          pacote_item_id: string
          valor_custo: number
        }
        Insert: {
          fornecedor_id: string
          id?: string
          ordem?: number
          pacote_item_id: string
          valor_custo: number
        }
        Update: {
          fornecedor_id?: string
          id?: string
          ordem?: number
          pacote_item_id?: string
          valor_custo?: number
        }
        Relationships: [
          {
            foreignKeyName: "pacote_item_fornecedores_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacote_item_fornecedores_pacote_item_id_fkey"
            columns: ["pacote_item_id"]
            isOneToOne: false
            referencedRelation: "pacote_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      pacote_itens: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          ordem: number
          pacote_id: string
          tipo_produto_id: string
          valores_extras: Json
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          pacote_id: string
          tipo_produto_id: string
          valores_extras?: Json
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          pacote_id?: string
          tipo_produto_id?: string
          valores_extras?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pacote_itens_pacote_id_fkey"
            columns: ["pacote_id"]
            isOneToOne: false
            referencedRelation: "pacotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacote_itens_tipo_produto_id_fkey"
            columns: ["tipo_produto_id"]
            isOneToOne: false
            referencedRelation: "tipos_produto"
            referencedColumns: ["id"]
          },
        ]
      }
      pacotes: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          data_fim_viagem: string
          data_inicio_viagem: string
          descricao: string | null
          empresa_id: string
          fornecedor_id: string | null
          id: string
          nome: string
          tipo_pacote: string
          tipo_produto_id: string | null
          updated_at: string
          valor_custo_total: number | null
          valores_extras: Json
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          data_fim_viagem: string
          data_inicio_viagem: string
          descricao?: string | null
          empresa_id: string
          fornecedor_id?: string | null
          id?: string
          nome: string
          tipo_pacote: string
          tipo_produto_id?: string | null
          updated_at?: string
          valor_custo_total?: number | null
          valores_extras?: Json
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          data_fim_viagem?: string
          data_inicio_viagem?: string
          descricao?: string | null
          empresa_id?: string
          fornecedor_id?: string | null
          id?: string
          nome?: string
          tipo_pacote?: string
          tipo_produto_id?: string | null
          updated_at?: string
          valor_custo_total?: number | null
          valores_extras?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pacotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacotes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacotes_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacotes_tipo_produto_id_fkey"
            columns: ["tipo_produto_id"]
            isOneToOne: false
            referencedRelation: "tipos_produto"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_pagar: {
        Row: {
          caixa_id: string | null
          cartao_id: string | null
          categoria_id: string | null
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
          is_manual: boolean
          numero: number
          observacoes: string | null
          status: string
          total_parcelas: number
          updated_at: string
          valor: number
          venda_produto_id: string | null
        }
        Insert: {
          caixa_id?: string | null
          cartao_id?: string | null
          categoria_id?: string | null
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
          is_manual?: boolean
          numero: number
          observacoes?: string | null
          status?: string
          total_parcelas: number
          updated_at?: string
          valor: number
          venda_produto_id?: string | null
        }
        Update: {
          caixa_id?: string | null
          cartao_id?: string | null
          categoria_id?: string | null
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
          is_manual?: boolean
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
            foreignKeyName: "parcelas_pagar_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagar_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagar_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
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
          {
            foreignKeyName: "parcelas_pagar_venda_produto_id_fkey"
            columns: ["venda_produto_id"]
            isOneToOne: false
            referencedRelation: "venda_produtos_efetivos"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_receber: {
        Row: {
          caixa_id: string | null
          cartao_id: string | null
          categoria_id: string | null
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
          is_manual: boolean
          numero: number
          observacoes: string | null
          status: string
          total_parcelas: number
          updated_at: string
          valor: number
          venda_id: string | null
        }
        Insert: {
          caixa_id?: string | null
          cartao_id?: string | null
          categoria_id?: string | null
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
          is_manual?: boolean
          numero: number
          observacoes?: string | null
          status?: string
          total_parcelas: number
          updated_at?: string
          valor: number
          venda_id?: string | null
        }
        Update: {
          caixa_id?: string | null
          cartao_id?: string | null
          categoria_id?: string | null
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
          is_manual?: boolean
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
            foreignKeyName: "parcelas_receber_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_receber_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_receber_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "parcelas_receber_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas_efetivas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_acesso: {
        Row: {
          ativo: boolean
          chave_sistema: string | null
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          permissoes: Json
          sistema: boolean
          tipo: string
        }
        Insert: {
          ativo?: boolean
          chave_sistema?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          permissoes?: Json
          sistema?: boolean
          tipo: string
        }
        Update: {
          ativo?: boolean
          chave_sistema?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          permissoes?: Json
          sistema?: boolean
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_acesso_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_comissoes: {
        Row: {
          created_at: string
          id: string
          observacao: string | null
          origem_id: string
          percentual: number
          perfil_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          observacao?: string | null
          origem_id: string
          percentual: number
          perfil_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          observacao?: string | null
          origem_id?: string
          percentual?: number
          perfil_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_comissoes_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "origens_venda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_comissoes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_cotacoes: {
        Row: {
          created_at: string
          dados_extraidos: Json | null
          empresa_id: string
          erro_mensagem: string | null
          id: string
          mime_type: string
          nome_arquivo: string
          proposta_id: string | null
          status: string
          storage_path: string | null
          tamanho_bytes: number | null
          tipo_entrada: string
          updated_at: string
          url_origem: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string
          dados_extraidos?: Json | null
          empresa_id: string
          erro_mensagem?: string | null
          id?: string
          mime_type: string
          nome_arquivo: string
          proposta_id?: string | null
          status?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo_entrada?: string
          updated_at?: string
          url_origem?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string
          dados_extraidos?: Json | null
          empresa_id?: string
          erro_mensagem?: string | null
          id?: string
          mime_type?: string
          nome_arquivo?: string
          proposta_id?: string | null
          status?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo_entrada?: string
          updated_at?: string
          url_origem?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_cotacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_cotacoes_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_cotacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_produtos: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          destino: string | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          observacoes: string | null
          ordem: number
          pax: number
          proposta_id: string
          tipo_produto_id: string | null
          tipo_produto_nome: string
          valor_venda: number
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          destino?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          observacoes?: string | null
          ordem?: number
          pax?: number
          proposta_id: string
          tipo_produto_id?: string | null
          tipo_produto_nome?: string
          valor_venda?: number
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          destino?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          observacoes?: string | null
          ordem?: number
          pax?: number
          proposta_id?: string
          tipo_produto_id?: string | null
          tipo_produto_nome?: string
          valor_venda?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposta_produtos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_produtos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_produtos_tipo_produto_id_fkey"
            columns: ["tipo_produto_id"]
            isOneToOne: false
            referencedRelation: "tipos_produto"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas: {
        Row: {
          cliente_email: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          created_at: string
          data_proposta: string
          destino: string | null
          empresa_id: string
          id: string
          identificador: string
          observacoes: string | null
          origem: string | null
          status: string
          updated_at: string
          usuario_id: string
          validade: string | null
          valor_total: number
        }
        Insert: {
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string
          data_proposta?: string
          destino?: string | null
          empresa_id: string
          id?: string
          identificador: string
          observacoes?: string | null
          origem?: string | null
          status?: string
          updated_at?: string
          usuario_id: string
          validade?: string | null
          valor_total?: number
        }
        Update: {
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string
          data_proposta?: string
          destino?: string | null
          empresa_id?: string
          id?: string
          identificador?: string
          observacoes?: string | null
          origem?: string | null
          status?: string
          updated_at?: string
          usuario_id?: string
          validade?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "propostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_produto: {
        Row: {
          ativo: boolean
          created_at: string
          icone: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          icone?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          icone?: string | null
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
          force_password_change: boolean
          foto_url: string | null
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
          force_password_change?: boolean
          foto_url?: string | null
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
          force_password_change?: boolean
          foto_url?: string | null
          id?: string
          iniciais?: string | null
          nome?: string
          perfil_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_empresas: {
        Row: {
          created_at: string
          empresa_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_empresas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_anexos: {
        Row: {
          created_at: string
          created_by: string
          id: string
          mime_type: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number
          venda_id: string | null
          wizard_session_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          mime_type: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number
          venda_id?: string | null
          wizard_session_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          mime_type?: string
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number
          venda_id?: string | null
          wizard_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venda_anexos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_anexos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_anexos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas_efetivas"
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
          passaporte: string | null
          venda_id: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome: string
          ordem?: number
          passaporte?: string | null
          venda_id: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome?: string
          ordem?: number
          passaporte?: string | null
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
          {
            foreignKeyName: "venda_passageiros_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas_efetivas"
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
          {
            foreignKeyName: "venda_produto_passageiros_venda_produto_id_fkey"
            columns: ["venda_produto_id"]
            isOneToOne: false
            referencedRelation: "venda_produtos_efetivos"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_produtos: {
        Row: {
          comissao_vendedor: number | null
          created_at: string
          data_emissao: string | null
          data_fim_viagem: string | null
          data_inicio_viagem: string | null
          destino: string | null
          fornecedor_id: string | null
          fornecedor_nome: string
          id: string
          localizador: string | null
          localizador_fornecedor: string | null
          ordem: number
          origem_pacote_id: string | null
          pgto_cartao_id: string | null
          pgto_data_debito: string | null
          pgto_entrada: number | null
          pgto_forma: string | null
          pgto_modo: string
          pgto_num_parcelas: number | null
          pgto_parcelas_detalhe: Json
          pgto_primeira_parcela_extra: number
          pgto_status: string
          pgto_valor_parcela: number | null
          pgto_valor_total: number | null
          rav: number | null
          rav_comissionado: number
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
          data_emissao?: string | null
          data_fim_viagem?: string | null
          data_inicio_viagem?: string | null
          destino?: string | null
          fornecedor_id?: string | null
          fornecedor_nome: string
          id?: string
          localizador?: string | null
          localizador_fornecedor?: string | null
          ordem?: number
          origem_pacote_id?: string | null
          pgto_cartao_id?: string | null
          pgto_data_debito?: string | null
          pgto_entrada?: number | null
          pgto_forma?: string | null
          pgto_modo?: string
          pgto_num_parcelas?: number | null
          pgto_parcelas_detalhe?: Json
          pgto_primeira_parcela_extra?: number
          pgto_status?: string
          pgto_valor_parcela?: number | null
          pgto_valor_total?: number | null
          rav?: number | null
          rav_comissionado?: number
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
          data_emissao?: string | null
          data_fim_viagem?: string | null
          data_inicio_viagem?: string | null
          destino?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string
          id?: string
          localizador?: string | null
          localizador_fornecedor?: string | null
          ordem?: number
          origem_pacote_id?: string | null
          pgto_cartao_id?: string | null
          pgto_data_debito?: string | null
          pgto_entrada?: number | null
          pgto_forma?: string | null
          pgto_modo?: string
          pgto_num_parcelas?: number | null
          pgto_parcelas_detalhe?: Json
          pgto_primeira_parcela_extra?: number
          pgto_status?: string
          pgto_valor_parcela?: number | null
          pgto_valor_total?: number | null
          rav?: number | null
          rav_comissionado?: number
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
            foreignKeyName: "venda_produtos_origem_pacote_id_fkey"
            columns: ["origem_pacote_id"]
            isOneToOne: false
            referencedRelation: "pacotes"
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
          {
            foreignKeyName: "venda_produtos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas_efetivas"
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
          comissao_percentual: number | null
          created_at: string
          data_aprovacao: string | null
          data_cancelamento: string | null
          data_venda: string
          desfluxo_aplicado: boolean
          desfluxo_meses: number
          desfluxo_percentual: number
          empresa_id: string
          flag_marketing: boolean
          id: string
          identificador: string
          indicacao_percentual: number | null
          motivo_devolucao: string | null
          motivo_revisao: string | null
          observacoes: string | null
          origem: string | null
          pax: number
          status: string
          tipo_venda: string
          updated_at: string
          usuario_id: string
          venda_original_id: string | null
        }
        Insert: {
          aprovado_por?: string | null
          cancelado_por?: string | null
          ciclo_faturamento_id?: string | null
          cliente_id: string
          comissao_percentual?: number | null
          created_at?: string
          data_aprovacao?: string | null
          data_cancelamento?: string | null
          data_venda: string
          desfluxo_aplicado?: boolean
          desfluxo_meses?: number
          desfluxo_percentual?: number
          empresa_id: string
          flag_marketing?: boolean
          id?: string
          identificador: string
          indicacao_percentual?: number | null
          motivo_devolucao?: string | null
          motivo_revisao?: string | null
          observacoes?: string | null
          origem?: string | null
          pax?: number
          status?: string
          tipo_venda?: string
          updated_at?: string
          usuario_id: string
          venda_original_id?: string | null
        }
        Update: {
          aprovado_por?: string | null
          cancelado_por?: string | null
          ciclo_faturamento_id?: string | null
          cliente_id?: string
          comissao_percentual?: number | null
          created_at?: string
          data_aprovacao?: string | null
          data_cancelamento?: string | null
          data_venda?: string
          desfluxo_aplicado?: boolean
          desfluxo_meses?: number
          desfluxo_percentual?: number
          empresa_id?: string
          flag_marketing?: boolean
          id?: string
          identificador?: string
          indicacao_percentual?: number | null
          motivo_devolucao?: string | null
          motivo_revisao?: string | null
          observacoes?: string | null
          origem?: string | null
          pax?: number
          status?: string
          tipo_venda?: string
          updated_at?: string
          usuario_id?: string
          venda_original_id?: string | null
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
          {
            foreignKeyName: "vendas_venda_original_id_fkey"
            columns: ["venda_original_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_venda_original_id_fkey"
            columns: ["venda_original_id"]
            isOneToOne: false
            referencedRelation: "vendas_efetivas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas_rascunho: {
        Row: {
          created_at: string
          dados: Json
          empresa_id: string | null
          id: string
          step: number
          titulo: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          dados?: Json
          empresa_id?: string | null
          id?: string
          step?: number
          titulo?: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          dados?: Json
          empresa_id?: string | null
          id?: string
          step?: number
          titulo?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_rascunho_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_rascunho_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      venda_produtos_efetivos: {
        Row: {
          comissao_vendedor: number | null
          created_at: string | null
          data_emissao: string | null
          data_fim_viagem: string | null
          data_inicio_viagem: string | null
          destino: string | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string | null
          localizador: string | null
          localizador_fornecedor: string | null
          ordem: number | null
          pgto_cartao_id: string | null
          pgto_data_debito: string | null
          pgto_entrada: number | null
          pgto_forma: string | null
          pgto_modo: string | null
          pgto_num_parcelas: number | null
          pgto_parcelas_detalhe: Json | null
          pgto_primeira_parcela_extra: number | null
          pgto_valor_parcela: number | null
          pgto_valor_total: number | null
          rav: number | null
          rav_extra_cliente: number | null
          rav_extra_fornecedor: number | null
          tipo_comissao: string | null
          tipo_produto_id: string | null
          tipo_produto_nome: string | null
          valor_custo: number | null
          valor_venda: number | null
          valores_extras: Json | null
          venda_id: string | null
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
        ]
      }
      vendas_efetivas: {
        Row: {
          aprovado_por: string | null
          cliente_id: string | null
          comissao_percentual: number | null
          created_at: string | null
          data_aprovacao: string | null
          data_venda: string | null
          desfluxo_aplicado: boolean | null
          desfluxo_meses: number | null
          desfluxo_percentual: number | null
          empresa_id: string | null
          id: string | null
          identificador: string | null
          indicacao_percentual: number | null
          motivo_revisao: string | null
          observacoes: string | null
          origem: string | null
          pax: number | null
          status: string | null
          tem_alteracao: boolean | null
          usuario_id: string | null
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
    Functions: {
      agenda_eh_compartilhado: {
        Args: { p_evento_id: string }
        Returns: boolean
      }
      agenda_eh_dono: { Args: { p_evento_id: string }; Returns: boolean }
      alterar_minha_senha: {
        Args: { p_nova_senha: string; p_senha_atual: string }
        Returns: undefined
      }
      app_user_empresas: { Args: never; Returns: string[] }
      app_user_perfil_nome: { Args: never; Returns: string }
      aprovar_venda:
        | { Args: { p_venda_id: string }; Returns: undefined }
        | {
            Args: {
              p_aprovador_id: string
              p_ignorar_desfluxo?: boolean
              p_venda_id: string
            }
            Returns: undefined
          }
      atualizar_empresas_usuario: {
        Args: { p_empresa_ids: string[]; p_user_id: string }
        Returns: undefined
      }
      atualizar_fornecedor: {
        Args: {
          p_cnpj: string
          p_id: string
          p_modo_comissionado?: boolean
          p_modo_comissionado_dia?: number
          p_modo_net?: boolean
          p_nome: string
          p_tipo?: string
          p_tipos_produto_ids?: string[]
        }
        Returns: undefined
      }
      atualizar_foto_usuario: {
        Args: { p_foto_url?: string; p_user_id: string }
        Returns: undefined
      }
      atualizar_pacote: {
        Args: {
          p_data_fim_viagem: string
          p_data_inicio_viagem: string
          p_descricao: string
          p_fornecedor_id?: string
          p_id: string
          p_itens?: Json
          p_nome: string
          p_tipo_pacote: string
          p_tipo_produto_id?: string
          p_valor_custo_total?: number
          p_valores_extras?: Json
        }
        Returns: undefined
      }
      calc_desfluxo_venda: { Args: { p_venda_id: string }; Returns: undefined }
      comissao_efetiva_perfil: {
        Args: { p_origem_id: string; p_perfil_id: string }
        Returns: number
      }
      compartilham_empresa: { Args: { p_usuario_id: string }; Returns: boolean }
      criar_alteracao_venda: { Args: { p_payload: Json }; Returns: string }
      criar_fornecedor: {
        Args: {
          p_cnpj: string
          p_modo_comissionado?: boolean
          p_modo_comissionado_dia?: number
          p_modo_net?: boolean
          p_nome: string
          p_tipo?: string
          p_tipos_produto_ids?: string[]
        }
        Returns: string
      }
      criar_pacote: {
        Args: {
          p_created_by?: string
          p_data_fim_viagem: string
          p_data_inicio_viagem: string
          p_descricao: string
          p_empresa_id: string
          p_fornecedor_id?: string
          p_itens?: Json
          p_nome: string
          p_tipo_pacote: string
          p_tipo_produto_id?: string
          p_valor_custo_total?: number
          p_valores_extras?: Json
        }
        Returns: string
      }
      criar_usuario_admin: {
        Args: {
          p_email: string
          p_empresa_ids: string[]
          p_forcar_troca?: boolean
          p_iniciais?: string
          p_nome: string
          p_perfil_id: string
          p_senha: string
        }
        Returns: string
      }
      criar_venda_completa: { Args: { p_payload: Json }; Returns: string }
      devolver_venda: {
        Args: { p_motivo: string; p_revisor_id: string; p_venda_id: string }
        Returns: undefined
      }
      editar_venda_completa: {
        Args: { p_aprovar?: boolean; p_payload: Json; p_venda_id: string }
        Returns: undefined
      }
      excluir_usuario_admin: { Args: { p_user_id: string }; Returns: undefined }
      excluir_venda: {
        Args: { p_motivo?: string; p_venda_id: string }
        Returns: undefined
      }
      gerar_identificador_proposta: {
        Args: { p_empresa_id: string }
        Returns: string
      }
      gerar_parcelas_pagar: { Args: { p_venda_id: string }; Returns: undefined }
      gerar_parcelas_receber: {
        Args: { p_venda_id: string }
        Returns: undefined
      }
      get_agenda_eventos: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          cor: string
          descricao: string
          dia: string
          hora_fim: string
          hora_inicio: string
          id: string
          referencia_id: string
          referencia_tipo: string
          tipo: string
          titulo: string
          valor: number
        }[]
      }
      get_usuario_completo: { Args: { p_user_id: string }; Returns: Json }
      get_usuarios_ultima_interacao: {
        Args: { p_user_ids: string[] }
        Returns: {
          ultima_interacao: string
          usuario_id: string
        }[]
      }
      get_usuarios_ultimo_login: {
        Args: { p_user_ids: string[] }
        Returns: {
          ultimo_login: string
          usuario_id: string
        }[]
      }
      has_permissao: {
        Args: { acao: string; modulo: string }
        Returns: boolean
      }
      is_administrador: { Args: never; Returns: boolean }
      is_agente: { Args: never; Returns: boolean }
      is_gerente: { Args: never; Returns: boolean }
      listar_usuarios_para_compartilhar: {
        Args: never
        Returns: {
          id: string
          nome: string
          perfil_nome: string
        }[]
      }
      mesma_empresa: { Args: { p_empresa_id: string }; Returns: boolean }
      obter_venda_para_alteracao: {
        Args: { p_venda_id: string }
        Returns: Json
      }
      proximo_numero_fatura: {
        Args: { p_ano: number; p_empresa_id: string }
        Returns: number
      }
      resetar_senha_usuario: {
        Args: { p_nova_senha: string; p_user_id: string }
        Returns: undefined
      }
      resubmeter_venda: {
        Args: { p_payload: Json; p_venda_id: string }
        Returns: undefined
      }
      tem_permissao_dashboard: { Args: never; Returns: boolean }
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
