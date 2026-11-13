-- ============================================================================
-- SUPABASE SETUP SQL — PORTFÓLIO EMERSON CARVALHO
-- Execute este script completo no SQL Editor do seu projeto Supabase.
-- ============================================================================

-- 1. Extensão para geração de UUID (caso ainda não esteja ativa)
create extension if not exists pgcrypto;

-- 2. Tabela principal: midias
create table if not exists public.midias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text default '',
  categoria text not null check (
    categoria in (
      'Shows',
      'Apresentações',
      'Coreografias',
      'Espetáculos',
      'Ensaios',
      'Eventos'
    )
  ),
  arquivo_url text not null,
  tipo text not null check (tipo in ('foto', 'video')),
  data_publicacao timestamptz not null default now(),
  publicado boolean not null default true
);

-- 3. Índices para consultas rápidas e otimizadas na galeria pública
create index if not exists idx_midias_publicado_data
  on public.midias (publicado, data_publicacao desc);

create index if not exists idx_midias_categoria
  on public.midias (categoria);

create index if not exists idx_midias_tipo
  on public.midias (tipo);

-- 4. Habilitar Row Level Security (RLS) na tabela midias
alter table public.midias enable row level security;

-- Remover políticas anteriores caso esteja reexecutando o script
drop policy if exists "Leitura pública de mídias publicadas" on public.midias;
drop policy if exists "Admin lê todas as mídias" on public.midias;
drop policy if exists "Admin publica novas mídias" on public.midias;
drop policy if exists "Admin atualiza mídias" on public.midias;
drop policy if exists "Admin exclui mídias" on public.midias;

-- Visitantes (anônimos ou autenticados) só podem ver registros com publicado = true
create policy "Leitura pública de mídias publicadas"
  on public.midias
  for select
  to anon, authenticated
  using (publicado = true);

-- Administrador autenticado pode ler também itens ocultos/rascunhos
create policy "Admin lê todas as mídias"
  on public.midias
  for select
  to authenticated
  using (auth.role() = 'authenticated');

-- Somente administrador autenticado pode inserir mídias
create policy "Admin publica novas mídias"
  on public.midias
  for insert
  to authenticated
  with check (auth.role() = 'authenticated');

-- Somente administrador autenticado pode editar mídias
create policy "Admin atualiza mídias"
  on public.midias
  for update
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Somente administrador autenticado pode excluir mídias
create policy "Admin exclui mídias"
  on public.midias
  for delete
  to authenticated
  using (auth.role() = 'authenticated');

-- 5. Criação do Bucket público no Supabase Storage: portfolio-emerson
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-emerson',
  'portfolio-emerson',
  true,
  104857600, -- Limite de 100MB por arquivo
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 6. Políticas de segurança (RLS) do Supabase Storage para o bucket portfolio-emerson
drop policy if exists "Leitura pública portfolio-emerson" on storage.objects;
drop policy if exists "Upload autenticado portfolio-emerson" on storage.objects;
drop policy if exists "Atualização autenticada portfolio-emerson" on storage.objects;
drop policy if exists "Exclusão autenticada portfolio-emerson" on storage.objects;

-- Qualquer visitante pode visualizar imagens e reproduzir vídeos do bucket
create policy "Leitura pública portfolio-emerson"
  on storage.objects
  for select
  to public
  using (bucket_id = 'portfolio-emerson');

-- Apenas administrador autenticado pode enviar arquivos
create policy "Upload autenticado portfolio-emerson"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'portfolio-emerson'
    and auth.role() = 'authenticated'
  );

-- Apenas administrador autenticado pode atualizar arquivos
create policy "Atualização autenticada portfolio-emerson"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'portfolio-emerson'
    and auth.role() = 'authenticated'
  )
  with check (
    bucket_id = 'portfolio-emerson'
    and auth.role() = 'authenticated'
  );

-- Apenas administrador autenticado pode excluir arquivos
create policy "Exclusão autenticada portfolio-emerson"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'portfolio-emerson'
    and auth.role() = 'authenticated'
  );

-- ============================================================================
-- IMPORTANTE SOBRE AUTENTICAÇÃO DO ADMINISTRADOR (SEM CADASTRO PÚBLICO):
-- 1. No painel do Supabase, acesse: Authentication -> Sign In / Providers -> Email
--    e DESATIVE a opção "Allow new users to sign up" (ou "Enable signups").
-- 2. Acesse: Authentication -> Users -> "Add user" -> "Create new user"
--    e cadastre manualmente o e-mail e a senha do Emerson Carvalho.
-- ============================================================================
