--
-- PostgreSQL database dump
--

-- \restrict TbiegWgmcUgfEsWpkTQmnw0tqFbcCOvOu0u7ElmBbNC3xcclLuHv3fmEZZkohIn

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: reserved_slugs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.reserved_slugs VALUES ('api');
INSERT INTO public.reserved_slugs VALUES ('admin');
INSERT INTO public.reserved_slugs VALUES ('www');
INSERT INTO public.reserved_slugs VALUES ('app');
INSERT INTO public.reserved_slugs VALUES ('auth');
INSERT INTO public.reserved_slugs VALUES ('login');
INSERT INTO public.reserved_slugs VALUES ('logout');
INSERT INTO public.reserved_slugs VALUES ('signup');
INSERT INTO public.reserved_slugs VALUES ('static');
INSERT INTO public.reserved_slugs VALUES ('_nuxt');
INSERT INTO public.reserved_slugs VALUES ('index');
INSERT INTO public.reserved_slugs VALUES ('received');
INSERT INTO public.reserved_slugs VALUES ('select-tenant');
INSERT INTO public.reserved_slugs VALUES ('unauthorized');
INSERT INTO public.reserved_slugs VALUES ('webhook');


--
-- PostgreSQL database dump complete
--

-- \unrestrict TbiegWgmcUgfEsWpkTQmnw0tqFbcCOvOu0u7ElmBbNC3xcclLuHv3fmEZZkohIn

