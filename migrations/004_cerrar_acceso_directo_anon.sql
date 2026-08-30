-- 004_cerrar_acceso_directo_anon.sql
-- Le quita a anon/authenticated el acceso directo a la base.
-- Todo el trafico legitimo del front pasa por RPC SECURITY DEFINER o por
-- el backend PHP con service_role: nada de esto cambia.
-- Rollback: 004_cerrar_acceso_directo_anon_ROLLBACK.sql

-- ── A. quitar ESCRITURA en tablas sin RLS ─────────────────────────────
-- Sin RLS, el grant es lo unico que separa a un visitante de un DELETE.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_festival_pre_dedup_v3" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_kardex_2026_legacy_20260731" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_registro_de_inscripcion_2026_20260430_230827" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_registro_kardex_2026_20260430_230827" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_registro_solicitud_2026_20260430_230827" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_cartas_invitacion_2026" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_contactos_global_Obsoleto" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_festival_contactos_global" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_historial_participaciones" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_instituciones" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_pagos_2026" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_participantes_2024" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_participantes_2025" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_recepcion_notas_2024" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_recepcion_notas_2025" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_registro_de_inscripcion_2024" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_registro_de_inscripcion_2025" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_registro_de_inscripcion_2026" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_registro_kardex_2026" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_registro_solicitud_2024" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_registro_solicitud_2025" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_registro_solicitud_2026" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_representantes" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_backup_zamorano_20260806_solicitantes" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."_merge_log" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."agente_ubicaciones" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."agentes" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."agrupacion_credenciales" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."bandeja_etiquetas" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."bandeja_etiquetas_conversacion" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."bot_config" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."bot_message_buffer" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."bot_reglas" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."cartas_invitacion_2025_legacy" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."compromisos_credenciales_2026" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."config_entradas_2026" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."cupones_2026" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."documents" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."entradas_2026" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."etiquetas_entradas_2026" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."festival_contactos_global" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."historial_participaciones" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."inscripcion_multimedia_estado" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."multimedia" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."n8n_chat_histories" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."notificaciones_usuario" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."plan_rutas" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."plan_rutas_paradas" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."plantillas_meta" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."recibos_emitidos" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."registro_visitas" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."rutas_colegios" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."ycloud_eventos_log" FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."zonas" FROM anon, authenticated;

-- ── B. quitar LECTURA donde ningun cliente lee ────────────────────────
-- Excluidas a proposito: las que tienen una policy RLS escrita para anon
-- (faq_preguntas, galeria_imagenes_home, videos_home, inscripciones_feed,
--  metodos_de_pago_2026, bandeja_*, bancosol_mosaico_fotos, nmm_*,
--  expofarma_bago_2026_encuesta_preguntas). Ahi la lectura es deliberada.
REVOKE SELECT ON public."_backup_festival_pre_dedup_v3" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_kardex_2026_legacy_20260731" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_registro_de_inscripcion_2026_20260430_230827" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_registro_kardex_2026_20260430_230827" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_registro_solicitud_2026_20260430_230827" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_cartas_invitacion_2026" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_contactos_global_Obsoleto" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_festival_contactos_global" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_historial_participaciones" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_instituciones" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_pagos_2026" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_participantes_2024" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_participantes_2025" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_recepcion_notas_2024" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_recepcion_notas_2025" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_registro_de_inscripcion_2024" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_registro_de_inscripcion_2025" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_registro_de_inscripcion_2026" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_registro_kardex_2026" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_registro_solicitud_2024" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_registro_solicitud_2025" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_registro_solicitud_2026" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_representantes" FROM anon, authenticated;
REVOKE SELECT ON public."_backup_zamorano_20260806_solicitantes" FROM anon, authenticated;
REVOKE SELECT ON public."_merge_log" FROM anon, authenticated;
REVOKE SELECT ON public."agentes" FROM anon, authenticated;
REVOKE SELECT ON public."agrupacion_credenciales" FROM anon, authenticated;
REVOKE SELECT ON public."bandeja_etiquetas" FROM anon, authenticated;
REVOKE SELECT ON public."bandeja_etiquetas_conversacion" FROM anon, authenticated;
REVOKE SELECT ON public."bot_config" FROM anon, authenticated;
REVOKE SELECT ON public."bot_message_buffer" FROM anon, authenticated;
REVOKE SELECT ON public."bot_reglas" FROM anon, authenticated;
REVOKE SELECT ON public."cartas_invitacion_2025_legacy" FROM anon, authenticated;
REVOKE SELECT ON public."compromisos_credenciales_2026" FROM anon, authenticated;
REVOKE SELECT ON public."config_entradas_2026" FROM anon, authenticated;
REVOKE SELECT ON public."crm_contactos" FROM anon, authenticated;
REVOKE SELECT ON public."cupones_2026" FROM anon, authenticated;
REVOKE SELECT ON public."deudas_2026" FROM anon, authenticated;
REVOKE SELECT ON public."documents" FROM anon, authenticated;
REVOKE SELECT ON public."festival_contactos_global" FROM anon, authenticated;
REVOKE SELECT ON public."historial_participaciones" FROM anon, authenticated;
REVOKE SELECT ON public."inscripcion_multimedia_estado" FROM anon, authenticated;
REVOKE SELECT ON public."multimedia" FROM anon, authenticated;
REVOKE SELECT ON public."n8n_chat_histories" FROM anon, authenticated;
REVOKE SELECT ON public."notificaciones_usuario" FROM anon, authenticated;
REVOKE SELECT ON public."pagos_2025_normalized" FROM anon, authenticated;
REVOKE SELECT ON public."pagos_2026_normalized" FROM anon, authenticated;
REVOKE SELECT ON public."pagos_historial_all" FROM anon, authenticated;
REVOKE SELECT ON public."plantillas_meta" FROM anon, authenticated;
REVOKE SELECT ON public."recibos_emitidos" FROM anon, authenticated;
REVOKE SELECT ON public."registro_visitas" FROM anon, authenticated;
REVOKE SELECT ON public."v_campanas_dashboard" FROM anon, authenticated;
REVOKE SELECT ON public."v_carnets_validos" FROM anon, authenticated;
REVOKE SELECT ON public."v_envios_pendientes" FROM anon, authenticated;
REVOKE SELECT ON public."vimeo_fb_progreso" FROM anon, authenticated;
REVOKE SELECT ON public."ycloud_eventos_log" FROM anon, authenticated;
REVOKE SELECT ON public."zonas" FROM anon, authenticated;

-- ── C. membresias: que solo las marque n8n con service_role ───────────
REVOKE EXECUTE ON FUNCTION public.marcar_membresia_paquete_2026(p_owner_id text, p_origen text, p_id_kardex text, p_id_contacto text, p_order_id bigint, p_monto numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_membresia_paquete_2026(p_owner_id text, p_origen text, p_id_kardex text, p_id_contacto text, p_order_id bigint, p_monto numeric) TO service_role;
REVOKE EXECUTE ON FUNCTION public.marcar_membresia_videos_2026(p_owner_id text, p_origen text, p_id_kardex text, p_id_contacto text, p_order_id bigint, p_monto numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_membresia_videos_2026(p_owner_id text, p_origen text, p_id_kardex text, p_id_contacto text, p_order_id bigint, p_monto numeric) TO service_role;
REVOKE EXECUTE ON FUNCTION public.marcar_membresia_pagada(p_id_kardex text, p_order_id bigint, p_monto numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_membresia_pagada(p_id_kardex text, p_order_id bigint, p_monto numeric) TO service_role;
REVOKE EXECUTE ON FUNCTION public.marcar_membresia_paquete_pagada(p_id_kardex text, p_order_id bigint, p_monto numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_membresia_paquete_pagada(p_id_kardex text, p_order_id bigint, p_monto numeric) TO service_role;

-- ── D. causa raiz: que las tablas NUEVAS no nazcan abiertas ───────────
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- ── E. el buscador de login no se llama desde el navegador ────────────────
-- search_login_users devuelve carnet, telefono y correo. Solo la usa
-- search-participants.php, que va con service_role: anon no la necesita.
-- Con login solo-carnet (migracion 003), el carnet ES la contrasena.
REVOKE EXECUTE ON FUNCTION public.search_login_users(p_query text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_login_users(p_query text) TO service_role;
