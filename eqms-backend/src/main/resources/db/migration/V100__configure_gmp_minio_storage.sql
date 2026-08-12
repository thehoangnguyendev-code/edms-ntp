UPDATE system_configurations
SET integrations_config = jsonb_set(
        integrations_config,
        '{storage}',
        (
            COALESCE(integrations_config->'storage', '{}'::jsonb)
            - ARRAY[
                'bucketName',
                'region',
                'accessKeyId',
                'secretAccessKey',
                'basePath',
                'minioEndpoint',
                'minioBucket',
                'minioAccessKeyId',
                'minioSecretAccessKey',
                'minioBasePath',
                'minioRetentionYears',
                'documentsPrefix',
                'controlledCopiesPrefix',
                'templatesPrefix',
                'trainingPrefix',
                'auditPrefix',
                'tempPrefix'
            ]
        ) || jsonb_build_object(
            'provider', 'minio',
            'enableCdn', false,
            'cdnUrl', '',
            'documentsPrefix', 'documents',
            'controlledCopiesPrefix', 'controlled-copies',
            'templatesPrefix', 'templates',
            'trainingPrefix', 'training',
            'auditPrefix', 'audit',
            'tempPrefix', 'temp'
        ),
        true
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'default';
