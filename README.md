# Zênite OS

Sistema de Gestão Multi-tenant Premium para Lojas de Celulares desenvolvido pela Vextron Lab.

## Build para Produção

Para gerar o build de produção localmente ou no servidor de deploy contínuo, execute:

```bash
npm install && npm run build
```

## Instruções de Deploy (Render)

**ATENÇÃO:** No painel do Render, é estritamente necessário cadastrar manualmente as seguintes variáveis de ambiente para que o sistema consiga se conectar ao banco de dados:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Se essas variáveis não forem preenchidas nas configurações de **Environment Variables** do Render, a aplicação não funcionará corretamente.
