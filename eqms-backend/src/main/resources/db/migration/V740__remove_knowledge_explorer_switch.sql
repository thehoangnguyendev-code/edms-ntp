-- The classic Knowledge Base page is gone: the Explorer is the only Knowledge Base, so the administrator switch that chose between
-- them (V451) no longer exists. Take the key out of the stored general configuration.
UPDATE system_configurations
SET general_config = general_config #- '{appearance,knowledgeExplorerEnabled}'
WHERE general_config #> '{appearance}' ? 'knowledgeExplorerEnabled';
