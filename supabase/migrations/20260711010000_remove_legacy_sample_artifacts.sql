delete from public.artifacts
where source_artifact_id is not null
  and source_artifact_id <> 'black-myth-wukong';
