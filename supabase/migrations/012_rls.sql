-- =============================================================================
-- 012 — Row Level Security (RLS)
-- =============================================================================
-- Estratégia:
--   - Helper functions em SECURITY DEFINER para ler perfil/empresa do usuário
--     (evita recursão infinita ao consultar usuarios dentro de policies)
--   - is_administrador(): vê tudo (todas empresas)
--   - Outros: restringidos por empresa_id do próprio usuário
--   - Agente: regras adicionais em vendas (só edita próprias vendas em rascunho)
--   - audit_logs: imutável (sem UPDATE/DELETE para ninguém)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER — bypassam RLS para evitar recursão)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_user_perfil_nome()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.nome
  FROM usuarios u
  JOIN perfis_acesso p ON p.id = u.perfil_id
  WHERE u.id = auth.uid()
    AND u.ativo = true
$$;

CREATE OR REPLACE FUNCTION app_user_empresa_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT empresa_id
  FROM usuarios
  WHERE id = auth.uid()
    AND ativo = true
$$;

CREATE OR REPLACE FUNCTION is_administrador()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN perfis_acesso p ON p.id = u.perfil_id
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND p.nome = 'Administrador'
  )
$$;

CREATE OR REPLACE FUNCTION is_gerente()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN perfis_acesso p ON p.id = u.perfil_id
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND p.nome = 'Gerente'
  )
$$;

CREATE OR REPLACE FUNCTION is_agente()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN perfis_acesso p ON p.id = u.perfil_id
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND p.nome = 'Agente'
  )
$$;

-- mesma_empresa(uuid) — true se o registro pertence à empresa do usuário
CREATE OR REPLACE FUNCTION mesma_empresa(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    is_administrador()
    OR p_empresa_id = app_user_empresa_id()
$$;

COMMENT ON FUNCTION app_user_perfil_nome IS 'Nome do perfil do usuário autenticado. SECURITY DEFINER para evitar recursão em RLS.';
COMMENT ON FUNCTION mesma_empresa IS 'True se Administrador ou se o empresa_id passado é o do usuário.';

-- =============================================================================
-- Habilitar RLS em todas as tabelas
-- =============================================================================

ALTER TABLE empresas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis_acesso         ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_produto         ENABLE ROW LEVEL SECURITY;
ALTER TABLE campos_extra          ENABLE ROW LEVEL SECURITY;
ALTER TABLE campos_extra_opcoes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_produto_campos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_passageiros     ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_produtos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_produto_passageiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobranca_cliente      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobranca_cliente_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_receber      ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_pagar        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ciclos_faturamento    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lembretes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs      ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- empresas — todos autenticados leem; só Administrador escreve
-- =============================================================================
CREATE POLICY empresas_select ON empresas
  FOR SELECT TO authenticated
  USING (
    is_administrador()
    OR id = app_user_empresa_id()
  );

CREATE POLICY empresas_admin_write ON empresas
  FOR ALL TO authenticated
  USING (is_administrador())
  WITH CHECK (is_administrador());

-- =============================================================================
-- perfis_acesso — todos autenticados leem; só Administrador escreve
-- =============================================================================
CREATE POLICY perfis_select ON perfis_acesso
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY perfis_admin_write ON perfis_acesso
  FOR ALL TO authenticated
  USING (is_administrador())
  WITH CHECK (is_administrador());

-- =============================================================================
-- usuarios
-- =============================================================================
-- SELECT: Administrador vê todos; demais veem só usuários da própria empresa + ele mesmo
CREATE POLICY usuarios_select ON usuarios
  FOR SELECT TO authenticated
  USING (
    is_administrador()
    OR id = auth.uid()
    OR empresa_id = app_user_empresa_id()
  );

-- INSERT/UPDATE/DELETE: só Administrador
CREATE POLICY usuarios_admin_write ON usuarios
  FOR ALL TO authenticated
  USING (is_administrador())
  WITH CHECK (is_administrador());

-- Permitir usuário atualizar a si mesmo (ex: force_password_change → false)
CREATE POLICY usuarios_self_update ON usuarios
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =============================================================================
-- clientes — isoladas por empresa
-- =============================================================================
CREATE POLICY clientes_select ON clientes
  FOR SELECT TO authenticated
  USING (mesma_empresa(empresa_id));

CREATE POLICY clientes_insert ON clientes
  FOR INSERT TO authenticated
  WITH CHECK (mesma_empresa(empresa_id));

CREATE POLICY clientes_update ON clientes
  FOR UPDATE TO authenticated
  USING (mesma_empresa(empresa_id))
  WITH CHECK (mesma_empresa(empresa_id));

-- Delete: só Administrador (Agentes/Gerentes nunca deletam clientes)
CREATE POLICY clientes_delete ON clientes
  FOR DELETE TO authenticated
  USING (is_administrador());

-- =============================================================================
-- fornecedores — globais (sem empresa_id); todos leem, só Administrador escreve
-- =============================================================================
CREATE POLICY fornecedores_select ON fornecedores
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY fornecedores_admin_write ON fornecedores
  FOR ALL TO authenticated
  USING (is_administrador())
  WITH CHECK (is_administrador());

-- Permitir INSERT por qualquer usuário autenticado (fluxo "Outros" no formulário)
CREATE POLICY fornecedores_insert_qualquer ON fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================================================
-- tipos_produto + campos_extra + opcoes + junction — globais, escrita só Admin
-- =============================================================================
CREATE POLICY tipos_produto_select ON tipos_produto
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tipos_produto_admin_write ON tipos_produto
  FOR ALL TO authenticated
  USING (is_administrador())
  WITH CHECK (is_administrador());

CREATE POLICY campos_extra_select ON campos_extra
  FOR SELECT TO authenticated USING (true);

CREATE POLICY campos_extra_admin_write ON campos_extra
  FOR ALL TO authenticated
  USING (is_administrador())
  WITH CHECK (is_administrador());

CREATE POLICY campos_extra_opcoes_select ON campos_extra_opcoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY campos_extra_opcoes_admin_write ON campos_extra_opcoes
  FOR ALL TO authenticated
  USING (is_administrador())
  WITH CHECK (is_administrador());

CREATE POLICY tipos_produto_campos_select ON tipos_produto_campos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tipos_produto_campos_admin_write ON tipos_produto_campos
  FOR ALL TO authenticated
  USING (is_administrador())
  WITH CHECK (is_administrador());

-- =============================================================================
-- vendas — isolamento por empresa + Agente só edita as próprias em rascunho
-- =============================================================================
CREATE POLICY vendas_select ON vendas
  FOR SELECT TO authenticated
  USING (
    mesma_empresa(empresa_id)
    AND (
      is_administrador()
      OR is_gerente()
      OR usuario_id = auth.uid()  -- Agente vê só as próprias
    )
  );

CREATE POLICY vendas_insert ON vendas
  FOR INSERT TO authenticated
  WITH CHECK (
    mesma_empresa(empresa_id)
    AND usuario_id = auth.uid()   -- agente registrado é o próprio usuário
  );

-- UPDATE: Administrador/Gerente sempre podem; Agente só em rascunho/devolvido
CREATE POLICY vendas_update ON vendas
  FOR UPDATE TO authenticated
  USING (
    mesma_empresa(empresa_id)
    AND (
      is_administrador()
      OR is_gerente()
      OR (usuario_id = auth.uid() AND status = 'rascunho')
    )
  )
  WITH CHECK (mesma_empresa(empresa_id));

-- DELETE de venda nunca permitido (use status=cancelado)
-- Sem policy de DELETE → bloqueado por padrão (RLS default deny)

-- =============================================================================
-- venda_passageiros + venda_produtos + venda_produto_passageiros
-- (isolamento via JOIN com vendas)
-- =============================================================================
CREATE POLICY venda_passageiros_select ON venda_passageiros
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = venda_passageiros.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (is_administrador() OR is_gerente() OR v.usuario_id = auth.uid())
  ));

CREATE POLICY venda_passageiros_write ON venda_passageiros
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = venda_passageiros.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (
        is_administrador()
        OR is_gerente()
        OR (v.usuario_id = auth.uid() AND v.status = 'rascunho')
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = venda_passageiros.venda_id
      AND mesma_empresa(v.empresa_id)
  ));

CREATE POLICY venda_produtos_select ON venda_produtos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = venda_produtos.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (is_administrador() OR is_gerente() OR v.usuario_id = auth.uid())
  ));

CREATE POLICY venda_produtos_write ON venda_produtos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = venda_produtos.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (
        is_administrador()
        OR is_gerente()
        OR (v.usuario_id = auth.uid() AND v.status = 'rascunho')
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = venda_produtos.venda_id
      AND mesma_empresa(v.empresa_id)
  ));

CREATE POLICY vpp_select ON venda_produto_passageiros
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM venda_produtos vp
    JOIN vendas v ON v.id = vp.venda_id
    WHERE vp.id = venda_produto_passageiros.venda_produto_id
      AND mesma_empresa(v.empresa_id)
      AND (is_administrador() OR is_gerente() OR v.usuario_id = auth.uid())
  ));

CREATE POLICY vpp_write ON venda_produto_passageiros
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM venda_produtos vp
    JOIN vendas v ON v.id = vp.venda_id
    WHERE vp.id = venda_produto_passageiros.venda_produto_id
      AND mesma_empresa(v.empresa_id)
      AND (
        is_administrador()
        OR is_gerente()
        OR (v.usuario_id = auth.uid() AND v.status = 'rascunho')
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM venda_produtos vp
    JOIN vendas v ON v.id = vp.venda_id
    WHERE vp.id = venda_produto_passageiros.venda_produto_id
      AND mesma_empresa(v.empresa_id)
  ));

-- =============================================================================
-- cobranca_cliente + itens (mesma lógica que venda_produtos)
-- =============================================================================
CREATE POLICY cobranca_select ON cobranca_cliente
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = cobranca_cliente.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (is_administrador() OR is_gerente() OR v.usuario_id = auth.uid())
  ));

CREATE POLICY cobranca_write ON cobranca_cliente
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = cobranca_cliente.venda_id
      AND mesma_empresa(v.empresa_id)
      AND (
        is_administrador()
        OR is_gerente()
        OR (v.usuario_id = auth.uid() AND v.status = 'rascunho')
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM vendas v
    WHERE v.id = cobranca_cliente.venda_id
      AND mesma_empresa(v.empresa_id)
  ));

CREATE POLICY cobranca_itens_select ON cobranca_cliente_itens
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cobranca_cliente c
    JOIN vendas v ON v.id = c.venda_id
    WHERE c.id = cobranca_cliente_itens.cobranca_id
      AND mesma_empresa(v.empresa_id)
      AND (is_administrador() OR is_gerente() OR v.usuario_id = auth.uid())
  ));

CREATE POLICY cobranca_itens_write ON cobranca_cliente_itens
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cobranca_cliente c
    JOIN vendas v ON v.id = c.venda_id
    WHERE c.id = cobranca_cliente_itens.cobranca_id
      AND mesma_empresa(v.empresa_id)
      AND (
        is_administrador()
        OR is_gerente()
        OR (v.usuario_id = auth.uid() AND v.status = 'rascunho')
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM cobranca_cliente c
    JOIN vendas v ON v.id = c.venda_id
    WHERE c.id = cobranca_cliente_itens.cobranca_id
      AND mesma_empresa(v.empresa_id)
  ));

-- =============================================================================
-- cartoes — isolados por empresa, escrita Administrador
-- =============================================================================
CREATE POLICY cartoes_select ON cartoes
  FOR SELECT TO authenticated
  USING (mesma_empresa(empresa_id));

CREATE POLICY cartoes_admin_write ON cartoes
  FOR ALL TO authenticated
  USING (is_administrador() AND mesma_empresa(empresa_id))
  WITH CHECK (is_administrador() AND mesma_empresa(empresa_id));

-- =============================================================================
-- parcelas_receber + parcelas_pagar — Agente NÃO vê (financeiro = restrito)
-- =============================================================================
CREATE POLICY parcelas_receber_select ON parcelas_receber
  FOR SELECT TO authenticated
  USING (
    mesma_empresa(empresa_id)
    AND (is_administrador() OR is_gerente())
  );

CREATE POLICY parcelas_receber_write ON parcelas_receber
  FOR ALL TO authenticated
  USING (
    mesma_empresa(empresa_id)
    AND (is_administrador() OR is_gerente())
  )
  WITH CHECK (
    mesma_empresa(empresa_id)
    AND (is_administrador() OR is_gerente())
  );

CREATE POLICY parcelas_pagar_select ON parcelas_pagar
  FOR SELECT TO authenticated
  USING (
    mesma_empresa(empresa_id)
    AND (is_administrador() OR is_gerente())
  );

CREATE POLICY parcelas_pagar_write ON parcelas_pagar
  FOR ALL TO authenticated
  USING (
    mesma_empresa(empresa_id)
    AND (is_administrador() OR is_gerente())
  )
  WITH CHECK (
    mesma_empresa(empresa_id)
    AND (is_administrador() OR is_gerente())
  );

-- =============================================================================
-- ciclos_faturamento — mesma lógica das parcelas
-- =============================================================================
CREATE POLICY ciclos_select ON ciclos_faturamento
  FOR SELECT TO authenticated
  USING (
    mesma_empresa(empresa_id)
    AND (is_administrador() OR is_gerente())
  );

CREATE POLICY ciclos_write ON ciclos_faturamento
  FOR ALL TO authenticated
  USING (
    mesma_empresa(empresa_id)
    AND (is_administrador() OR is_gerente())
  )
  WITH CHECK (
    mesma_empresa(empresa_id)
    AND (is_administrador() OR is_gerente())
  );

-- =============================================================================
-- lembretes
-- =============================================================================
CREATE POLICY lembretes_select ON lembretes
  FOR SELECT TO authenticated
  USING (
    is_administrador()
    OR mesma_empresa(empresa_id)
  );

-- Usuário pode dispensar (UPDATE status) seus próprios lembretes
CREATE POLICY lembretes_update_self ON lembretes
  FOR UPDATE TO authenticated
  USING (
    destinatario_id IS NULL
    OR destinatario_id = auth.uid()
    OR is_administrador()
  );

-- Insert/Delete: só service role (edge functions) ou Administrador
CREATE POLICY lembretes_admin_insert ON lembretes
  FOR INSERT TO authenticated
  WITH CHECK (is_administrador());

CREATE POLICY lembretes_admin_delete ON lembretes
  FOR DELETE TO authenticated
  USING (is_administrador());

-- =============================================================================
-- audit_logs — leitura para Administrador/Gerente; SEM UPDATE/DELETE
-- =============================================================================
CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT TO authenticated
  USING (
    is_administrador()
    OR (is_gerente() AND mesma_empresa(empresa_id))
  );

-- INSERT permitido para qualquer autenticado (escrito pela aplicação/edge function)
CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR is_administrador());

-- UPDATE e DELETE: SEM policies → bloqueados (RLS default deny). Audit é imutável.

-- =============================================================================
-- integration_logs — leitura Administrador
-- =============================================================================
CREATE POLICY integration_logs_select ON integration_logs
  FOR SELECT TO authenticated
  USING (is_administrador());

-- INSERT: qualquer autenticado (edge functions)
CREATE POLICY integration_logs_insert ON integration_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);
