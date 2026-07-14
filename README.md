# idee
Home-made note editor

## Configuration requise côté Supabase

**Migration `full_width` (note en pleine largeur) — à appliquer AVANT le
déploiement.** La colonne est ajoutée à la liste des colonnes chargées, donc
la requête `pages` échouerait tant qu'elle n'existe pas. Contenu de
`supabase/migrations/0002_full_width.sql` :

```sql
alter table public.pages
  add column if not exists full_width boolean not null default false;
```

**Synchronisation temps réel des notes (multi-onglets / multi-appareils).**
L'app s'abonne aux changements de la table `pages` via Supabase Realtime.
Pour que ça fonctionne, la table doit être ajoutée à la publication :

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE pages;
-- Optionnel mais recommandé pour propager les suppressions de façon fiable
-- entre appareils (sinon la ligne « old » d'un DELETE ne contient que l'id) :
ALTER TABLE pages REPLICA IDENTITY FULL;
```

Sans cette publication, l'app continue de fonctionner normalement mais les
modifications faites sur un autre appareil n'apparaissent pas en direct.

## Sécurité — actions recommandées côté Supabase

Ces points ne peuvent pas être corrigés dans le code de l'app et doivent
être appliqués dans le dashboard Supabase :

1. **Realtime sur `page_comments` (fuite `author_token`) — rien à faire.**
   `page_comments` n'est **pas** dans la publication `supabase_realtime` :
   le vecteur de fuite « diffusion du `author_token` en temps réel » n'existe
   donc pas. Les vrais vecteurs (SSR `select('*')` de la page partagée, et
   `GET /api/comments` renvoyant toutes les colonnes) sont corrigés côté code.

   ⚠️ **Ne pas** ajouter `page_comments` à la publication pour activer le
   live des commentaires : cela rouvrirait la fuite. Le live est désormais
   assuré autrement — via un canal Supabase **Broadcast** dont le payload est
   assaini côté serveur (sans `author_token`), voir `broadcastCommentEvent`
   dans `lib/comments.ts` et l'abonnement `broadcast` dans `ShareContent`.

2. **Buckets Storage `images` / `covers`** : ajouter une limite de taille et
   un filtre de type MIME côté serveur (le contrôle client, désormais en
   place, peut être contourné). Dans le dashboard Storage → bucket →
   Settings, ou en SQL :

   ```sql
   update storage.buckets
     set file_size_limit = 5242880,               -- 5 Mo
         allowed_mime_types = array['image/png','image/jpeg','image/gif','image/webp','image/svg+xml']
   where id in ('images', 'covers');
   ```

   **Nettoyage des images orphelines** — ✅ **géré côté code** : à la
   suppression **définitive** d'une note (corbeille → supprimer / vider), ses
   images et sa couverture uploadées sont retirées du Storage, sauf si une
   autre note les référence encore. Pour que cette suppression aboutisse, le
   rôle authentifié doit avoir le droit de supprimer ses propres objets —
   ajouter cette policy (une fois) :

   ```sql
   create policy "Users delete own storage objects"
     on storage.objects for delete to authenticated
     using (
       bucket_id in ('images', 'covers')
       and (storage.foldername(name))[1] = auth.uid()::text
     );
   ```

   Sans cette policy, le nettoyage échoue silencieusement (les fichiers
   restent, sans autre conséquence). Les fichiers déjà orphelins avant ce
   correctif ne sont pas rattrapés automatiquement.

3. **Rate-limit `/api/summarize`** — ✅ **corrigé côté code**, nécessite une
   migration. Appliquer une fois `supabase/migrations/0001_rate_limits.sql`
   (SQL Editor) : elle crée la table `rate_limits` et la fonction
   `check_rate_limit`. La route l'utilise avec un repli *fail-open* (si la
   fonction n'est pas encore déployée, les requêtes passent au lieu
   d'échouer).
