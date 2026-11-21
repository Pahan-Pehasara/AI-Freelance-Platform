USE master;
GO

IF DB_ID(N'AIFreelanceDB') IS NULL
BEGIN
    CREATE DATABASE AIFreelanceDB;
END;
GO

USE AIFreelanceDB;
GO

SELECT DB_NAME() AS CurrentDatabase;
USE AIFreelanceDB;
GO

IF OBJECT_ID(N'dbo.UserAccount', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserAccount (
        UserID INT IDENTITY(1,1) NOT NULL,
        FullName NVARCHAR(100) NOT NULL,
        Email NVARCHAR(254) NOT NULL,
        PasswordHash VARCHAR(255) NOT NULL,
        PhoneNumber NVARCHAR(25) NULL,
        UserRole VARCHAR(20) NOT NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_UserAccount_IsActive DEFAULT (1),
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_UserAccount_CreatedAt DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT PK_UserAccount PRIMARY KEY (UserID),
        CONSTRAINT UQ_UserAccount_Email UNIQUE (Email),
        CONSTRAINT CK_UserAccount_FullName
            CHECK (LEN(LTRIM(RTRIM(FullName))) > 0),
        CONSTRAINT CK_UserAccount_Email
            CHECK (LEN(LTRIM(RTRIM(Email))) > 0),
        CONSTRAINT CK_UserAccount_PasswordHash
            CHECK (LEN(PasswordHash) > 0),
        CONSTRAINT CK_UserAccount_UserRole
            CHECK (UserRole IN ('Client', 'Freelancer', 'Admin', 'Manager'))
    );
END;
GO

IF OBJECT_ID(N'dbo.Client', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Client (
        ClientID INT NOT NULL,
        CompanyName NVARCHAR(150) NULL,
        BillingAddress NVARCHAR(300) NULL,

        CONSTRAINT PK_Client PRIMARY KEY (ClientID),
        CONSTRAINT FK_Client_UserAccount
            FOREIGN KEY (ClientID)
            REFERENCES dbo.UserAccount(UserID)
    );
END;
GO

IF OBJECT_ID(N'dbo.Freelancer', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Freelancer (
        FreelancerID INT NOT NULL,
        ProfessionalTitle NVARCHAR(100) NULL,
        Bio NVARCHAR(1000) NULL,
        HourlyRate DECIMAL(10,2) NULL,
        PortfolioURL NVARCHAR(500) NULL,

        CONSTRAINT PK_Freelancer PRIMARY KEY (FreelancerID),
        CONSTRAINT FK_Freelancer_UserAccount
            FOREIGN KEY (FreelancerID)
            REFERENCES dbo.UserAccount(UserID),
        CONSTRAINT CK_Freelancer_HourlyRate
            CHECK (HourlyRate >= 0)
    );
END;
GO

SELECT
    TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'dbo'
  AND TABLE_TYPE = 'BASE TABLE'
  AND TABLE_NAME IN ('UserAccount', 'Client', 'Freelancer')
ORDER BY TABLE_NAME;
USE AIFreelanceDB;
GO

IF OBJECT_ID(N'dbo.Skill', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Skill (
        SkillID INT IDENTITY(1,1) NOT NULL,
        SkillName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,

        CONSTRAINT PK_Skill PRIMARY KEY (SkillID),
        CONSTRAINT UQ_Skill_SkillName UNIQUE (SkillName),
        CONSTRAINT CK_Skill_SkillName
            CHECK (LEN(LTRIM(RTRIM(SkillName))) > 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.FreelancerSkill', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FreelancerSkill (
        FreelancerID INT NOT NULL,
        SkillID INT NOT NULL,
        SkillLevel VARCHAR(20) NOT NULL,

        CONSTRAINT PK_FreelancerSkill
            PRIMARY KEY (FreelancerID, SkillID),
        CONSTRAINT FK_FreelancerSkill_Freelancer
            FOREIGN KEY (FreelancerID)
            REFERENCES dbo.Freelancer(FreelancerID),
        CONSTRAINT FK_FreelancerSkill_Skill
            FOREIGN KEY (SkillID)
            REFERENCES dbo.Skill(SkillID),
        CONSTRAINT CK_FreelancerSkill_SkillLevel
            CHECK (SkillLevel IN (
                'Beginner', 'Intermediate', 'Advanced', 'Expert'
            ))
    );
END;
GO

IF OBJECT_ID(N'dbo.AIService', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AIService (
        ServiceID INT IDENTITY(1,1) NOT NULL,
        ServiceName NVARCHAR(150) NOT NULL,
        Description NVARCHAR(1000) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_AIService_IsActive DEFAULT (1),

        CONSTRAINT PK_AIService PRIMARY KEY (ServiceID),
        CONSTRAINT UQ_AIService_ServiceName UNIQUE (ServiceName),
        CONSTRAINT CK_AIService_ServiceName
            CHECK (LEN(LTRIM(RTRIM(ServiceName))) > 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.FreelancerService', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FreelancerService (
        FreelancerID INT NOT NULL,
        ServiceID INT NOT NULL,
        ServiceDescription NVARCHAR(1000) NULL,
        StartingPrice DECIMAL(12,2) NOT NULL,

        CONSTRAINT PK_FreelancerService
            PRIMARY KEY (FreelancerID, ServiceID),
        CONSTRAINT FK_FreelancerService_Freelancer
            FOREIGN KEY (FreelancerID)
            REFERENCES dbo.Freelancer(FreelancerID),
        CONSTRAINT FK_FreelancerService_AIService
            FOREIGN KEY (ServiceID)
            REFERENCES dbo.AIService(ServiceID),
        CONSTRAINT CK_FreelancerService_StartingPrice
            CHECK (StartingPrice > 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.Project', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Project (
        ProjectID INT IDENTITY(1,1) NOT NULL,
        ClientID INT NOT NULL,
        ServiceID INT NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(MAX) NOT NULL,
        Budget DECIMAL(12,2) NOT NULL,
        Deadline DATE NOT NULL,
        ProjectStatus VARCHAR(20) NOT NULL
            CONSTRAINT DF_Project_ProjectStatus DEFAULT ('Open'),
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_Project_CreatedAt DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT PK_Project PRIMARY KEY (ProjectID),
        CONSTRAINT FK_Project_Client
            FOREIGN KEY (ClientID)
            REFERENCES dbo.Client(ClientID),
        CONSTRAINT FK_Project_AIService
            FOREIGN KEY (ServiceID)
            REFERENCES dbo.AIService(ServiceID),
        CONSTRAINT CK_Project_Title
            CHECK (LEN(LTRIM(RTRIM(Title))) > 0),
        CONSTRAINT CK_Project_Description
            CHECK (LEN(LTRIM(RTRIM(Description))) > 0),
        CONSTRAINT CK_Project_Budget
            CHECK (Budget > 0),
        CONSTRAINT CK_Project_ProjectStatus
            CHECK (ProjectStatus IN (
                'Open', 'InProgress', 'Completed', 'Cancelled'
            ))
    );
END;
GO

IF OBJECT_ID(N'dbo.ProjectSkill', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProjectSkill (
        ProjectID INT NOT NULL,
        SkillID INT NOT NULL,

        CONSTRAINT PK_ProjectSkill
            PRIMARY KEY (ProjectID, SkillID),
        CONSTRAINT FK_ProjectSkill_Project
            FOREIGN KEY (ProjectID)
            REFERENCES dbo.Project(ProjectID),
        CONSTRAINT FK_ProjectSkill_Skill
            FOREIGN KEY (SkillID)
            REFERENCES dbo.Skill(SkillID)
    );
END;
GO

SELECT
    TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'dbo'
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
USE AIFreelanceDB;
GO

IF OBJECT_ID(N'dbo.Proposal', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Proposal (
        ProposalID INT IDENTITY(1,1) NOT NULL,
        ProjectID INT NOT NULL,
        FreelancerID INT NOT NULL,
        CoverLetter NVARCHAR(2000) NOT NULL,
        BidAmount DECIMAL(12,2) NOT NULL,
        EstimatedDays INT NOT NULL,
        ProposalStatus VARCHAR(20) NOT NULL
            CONSTRAINT DF_Proposal_Status DEFAULT ('Pending'),
        SubmittedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_Proposal_SubmittedAt DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT PK_Proposal PRIMARY KEY (ProposalID),
        CONSTRAINT FK_Proposal_Project
            FOREIGN KEY (ProjectID)
            REFERENCES dbo.Project(ProjectID),
        CONSTRAINT FK_Proposal_Freelancer
            FOREIGN KEY (FreelancerID)
            REFERENCES dbo.Freelancer(FreelancerID),
        CONSTRAINT UQ_Proposal_ProjectFreelancer
            UNIQUE (ProjectID, FreelancerID),
        CONSTRAINT UQ_Proposal_IDProject
            UNIQUE (ProposalID, ProjectID),
        CONSTRAINT CK_Proposal_CoverLetter
            CHECK (LEN(LTRIM(RTRIM(CoverLetter))) > 0),
        CONSTRAINT CK_Proposal_BidAmount
            CHECK (BidAmount > 0),
        CONSTRAINT CK_Proposal_EstimatedDays
            CHECK (EstimatedDays > 0),
        CONSTRAINT CK_Proposal_Status
            CHECK (ProposalStatus IN (
                'Pending', 'Accepted', 'Rejected', 'Withdrawn'
            ))
    );
END;
GO

IF OBJECT_ID(N'dbo.Assignment', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Assignment (
        AssignmentID INT IDENTITY(1,1) NOT NULL,
        ProjectID INT NOT NULL,
        ProposalID INT NOT NULL,
        AgreedAmount DECIMAL(12,2) NOT NULL,
        AssignedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_Assignment_AssignedAt DEFAULT (SYSUTCDATETIME()),
        CompletedAt DATETIME2(0) NULL,

        CONSTRAINT PK_Assignment PRIMARY KEY (AssignmentID),
        CONSTRAINT UQ_Assignment_Project UNIQUE (ProjectID),
        CONSTRAINT UQ_Assignment_Proposal UNIQUE (ProposalID),
        CONSTRAINT FK_Assignment_Project
            FOREIGN KEY (ProjectID)
            REFERENCES dbo.Project(ProjectID),
        CONSTRAINT FK_Assignment_Proposal
            FOREIGN KEY (ProposalID, ProjectID)
            REFERENCES dbo.Proposal(ProposalID, ProjectID),
        CONSTRAINT CK_Assignment_AgreedAmount
            CHECK (AgreedAmount > 0),
        CONSTRAINT CK_Assignment_CompletedAt
            CHECK (CompletedAt IS NULL OR CompletedAt >= AssignedAt)
    );
END;
GO

IF OBJECT_ID(N'dbo.Payment', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Payment (
        PaymentID INT IDENTITY(1,1) NOT NULL,
        AssignmentID INT NOT NULL,
        Amount DECIMAL(12,2) NOT NULL,
        PaymentMethod VARCHAR(20) NOT NULL,
        PaymentStatus VARCHAR(20) NOT NULL
            CONSTRAINT DF_Payment_Status DEFAULT ('Pending'),
        TransactionReference NVARCHAR(100) NULL,
        PaidAt DATETIME2(0) NULL,
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_Payment_CreatedAt DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT PK_Payment PRIMARY KEY (PaymentID),
        CONSTRAINT FK_Payment_Assignment
            FOREIGN KEY (AssignmentID)
            REFERENCES dbo.Assignment(AssignmentID),
        CONSTRAINT CK_Payment_Amount
            CHECK (Amount > 0),
        CONSTRAINT CK_Payment_Method
            CHECK (PaymentMethod IN (
                'BankTransfer', 'Card', 'Cash', 'Other'
            )),
        CONSTRAINT CK_Payment_Status
            CHECK (PaymentStatus IN ('Pending', 'Completed', 'Failed')),
        CONSTRAINT CK_Payment_PaidAt
            CHECK (PaymentStatus <> 'Completed' OR PaidAt IS NOT NULL)
    );
END;
GO

IF OBJECT_ID(N'dbo.Review', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Review (
        ReviewID INT IDENTITY(1,1) NOT NULL,
        AssignmentID INT NOT NULL,
        ReviewerID INT NOT NULL,
        RevieweeID INT NOT NULL,
        Rating TINYINT NOT NULL,
        ReviewText NVARCHAR(2000) NULL,
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_Review_CreatedAt DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT PK_Review PRIMARY KEY (ReviewID),
        CONSTRAINT FK_Review_Assignment
            FOREIGN KEY (AssignmentID)
            REFERENCES dbo.Assignment(AssignmentID),
        CONSTRAINT FK_Review_Reviewer
            FOREIGN KEY (ReviewerID)
            REFERENCES dbo.UserAccount(UserID),
        CONSTRAINT FK_Review_Reviewee
            FOREIGN KEY (RevieweeID)
            REFERENCES dbo.UserAccount(UserID),
        CONSTRAINT UQ_Review_AssignmentReviewer
            UNIQUE (AssignmentID, ReviewerID),
        CONSTRAINT CK_Review_Rating
            CHECK (Rating BETWEEN 1 AND 5),
        CONSTRAINT CK_Review_DifferentUsers
            CHECK (ReviewerID <> RevieweeID)
    );
END;
GO

SELECT
    TABLE_NAME,
    COUNT(*) OVER () AS TotalTables
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'dbo'
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
USE AIFreelanceDB;
GO

CREATE OR ALTER TRIGGER dbo.trg_Review_Validate
ON dbo.Review
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted AS r
        INNER JOIN dbo.Assignment AS a
            ON r.AssignmentID = a.AssignmentID
        INNER JOIN dbo.Project AS p
            ON a.ProjectID = p.ProjectID
        INNER JOIN dbo.Proposal AS pr
            ON a.ProposalID = pr.ProposalID
        WHERE p.ProjectStatus <> 'Completed'
           OR a.CompletedAt IS NULL
           OR NOT (
                (
                    r.ReviewerID = p.ClientID
                    AND r.RevieweeID = pr.FreelancerID
                )
                OR
                (
                    r.ReviewerID = pr.FreelancerID
                    AND r.RevieweeID = p.ClientID
                )
           )
    )
    BEGIN
        ;THROW 50001,
            'Reviews are allowed only between the client and assigned freelancer after project completion.',
            1;
    END;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_Payment_ValidateAmount
ON dbo.Payment
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @AffectedAssignments TABLE (
        AssignmentID INT PRIMARY KEY
    );

    INSERT INTO @AffectedAssignments (AssignmentID)
    SELECT a.AssignmentID
    FROM dbo.Assignment AS a WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN (
        SELECT DISTINCT AssignmentID
        FROM inserted
    ) AS changed
        ON a.AssignmentID = changed.AssignmentID;

    IF EXISTS (
        SELECT 1
        FROM dbo.Assignment AS a
        INNER JOIN @AffectedAssignments AS affected
            ON a.AssignmentID = affected.AssignmentID
        WHERE (
            SELECT ISNULL(SUM(p.Amount), 0)
            FROM dbo.Payment AS p WITH (READCOMMITTEDLOCK)
            WHERE p.AssignmentID = a.AssignmentID
              AND p.PaymentStatus = 'Completed'
        ) > a.AgreedAmount
    )
    BEGIN
        ;THROW 50002,
            'Total completed payments cannot exceed the agreed assignment amount.',
            1;
    END;
END;
GO

SELECT
    name AS TriggerName,
    OBJECT_NAME(parent_id) AS TableName,
    is_disabled AS IsDisabled
FROM sys.triggers
WHERE name IN (
    'trg_Review_Validate',
    'trg_Payment_ValidateAmount'
)
ORDER BY name;
USE AIFreelanceDB;
GO

CREATE OR ALTER PROCEDURE dbo.usp_SelectFreelancer
    @ClientID INT,
    @ProjectID INT,
    @ProposalID INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ProjectStatus VARCHAR(20);
    DECLARE @BidAmount DECIMAL(12,2);
    DECLARE @AssignmentID INT;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @ProjectStatus = p.ProjectStatus
        FROM dbo.Project AS p WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.UserAccount AS u
            ON p.ClientID = u.UserID
        WHERE p.ProjectID = @ProjectID
          AND p.ClientID = @ClientID
          AND u.UserRole = 'Client'
          AND u.IsActive = 1;

        IF @ProjectStatus IS NULL
        BEGIN
            ;THROW 51001,
                'Project not found or client access denied.',
                1;
        END;

        IF @ProjectStatus <> 'Open'
        BEGIN
            ;THROW 51002,
                'Only open projects can be assigned.',
                1;
        END;

        IF EXISTS (
            SELECT 1
            FROM dbo.Assignment
            WHERE ProjectID = @ProjectID
        )
        BEGIN
            ;THROW 51003,
                'This project already has an assignment.',
                1;
        END;

        SELECT @BidAmount = pr.BidAmount
        FROM dbo.Proposal AS pr WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.Freelancer AS f
            ON pr.FreelancerID = f.FreelancerID
        INNER JOIN dbo.UserAccount AS u
            ON f.FreelancerID = u.UserID
        WHERE pr.ProposalID = @ProposalID
          AND pr.ProjectID = @ProjectID
          AND pr.ProposalStatus = 'Pending'
          AND u.UserRole = 'Freelancer'
          AND u.IsActive = 1;

        IF @BidAmount IS NULL
        BEGIN
            ;THROW 51004,
                'A pending proposal from an active freelancer is required.',
                1;
        END;

        INSERT INTO dbo.Assignment (
            ProjectID,
            ProposalID,
            AgreedAmount
        )
        VALUES (
            @ProjectID,
            @ProposalID,
            @BidAmount
        );

        SET @AssignmentID = CONVERT(INT, SCOPE_IDENTITY());

        UPDATE dbo.Proposal
        SET ProposalStatus =
            CASE
                WHEN ProposalID = @ProposalID THEN 'Accepted'
                ELSE 'Rejected'
            END
        WHERE ProjectID = @ProjectID
          AND ProposalStatus = 'Pending';

        UPDATE dbo.Project
        SET ProjectStatus = 'InProgress'
        WHERE ProjectID = @ProjectID;

        COMMIT TRANSACTION;

        SELECT
            @AssignmentID AS AssignmentID,
            @ProjectID AS ProjectID,
            @BidAmount AS AgreedAmount,
            'InProgress' AS ProjectStatus;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_RecordPayment
    @ClientID INT,
    @AssignmentID INT,
    @Amount DECIMAL(12,2),
    @PaymentMethod VARCHAR(20),
    @TransactionReference NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @AgreedAmount DECIMAL(12,2);
    DECLARE @TotalPaid DECIMAL(12,2);
    DECLARE @ProjectStatus VARCHAR(20);
    DECLARE @PaymentID INT;

    IF @Amount IS NULL OR @Amount <= 0
    BEGIN
        ;THROW 51005,
            'Payment amount must be greater than zero.',
            1;
    END;

    IF @PaymentMethod IS NULL
       OR @PaymentMethod NOT IN (
           'BankTransfer', 'Card', 'Cash', 'Other'
       )
    BEGIN
        ;THROW 51006,
            'Invalid payment method.',
            1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @AgreedAmount = a.AgreedAmount,
            @ProjectStatus = p.ProjectStatus
        FROM dbo.Assignment AS a WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.Project AS p WITH (UPDLOCK, HOLDLOCK)
            ON a.ProjectID = p.ProjectID
        INNER JOIN dbo.UserAccount AS u
            ON p.ClientID = u.UserID
        WHERE a.AssignmentID = @AssignmentID
          AND p.ClientID = @ClientID
          AND u.UserRole = 'Client'
          AND u.IsActive = 1;

        IF @AgreedAmount IS NULL
        BEGIN
            ;THROW 51007,
                'Assignment not found or client access denied.',
                1;
        END;

        IF @ProjectStatus NOT IN ('InProgress', 'Completed')
        BEGIN
            ;THROW 51008,
                'Payments require an in-progress or completed project.',
                1;
        END;

        SELECT @TotalPaid = ISNULL(SUM(Amount), 0)
        FROM dbo.Payment WITH (READCOMMITTEDLOCK)
        WHERE AssignmentID = @AssignmentID
          AND PaymentStatus = 'Completed';

        IF @Amount > @AgreedAmount - @TotalPaid
        BEGIN
            ;THROW 51009,
                'Payment exceeds the outstanding amount.',
                1;
        END;

        INSERT INTO dbo.Payment (
            AssignmentID,
            Amount,
            PaymentMethod,
            PaymentStatus,
            TransactionReference,
            PaidAt
        )
        VALUES (
            @AssignmentID,
            @Amount,
            @PaymentMethod,
            'Completed',
            NULLIF(LTRIM(RTRIM(@TransactionReference)), N''),
            SYSUTCDATETIME()
        );

        SET @PaymentID = CONVERT(INT, SCOPE_IDENTITY());

        COMMIT TRANSACTION;

        SELECT
            @PaymentID AS PaymentID,
            @AssignmentID AS AssignmentID,
            @Amount AS AmountPaid,
            @AgreedAmount - @TotalPaid - @Amount
                AS OutstandingAmount;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;
END;
GO

SELECT
    SCHEMA_NAME(schema_id) AS SchemaName,
    name AS ProcedureName
FROM sys.procedures
WHERE schema_id = SCHEMA_ID('dbo')
  AND name IN (
      'usp_SelectFreelancer',
      'usp_RecordPayment'
  )
ORDER BY name;
USE AIFreelanceDB;
GO

CREATE OR ALTER FUNCTION dbo.fn_FreelancerAverageRating (
    @FreelancerID INT
)
RETURNS DECIMAL(3,2)
AS
BEGIN
    DECLARE @AverageRating DECIMAL(3,2);

    SELECT @AverageRating = AVG(CAST(r.Rating AS DECIMAL(5,2)))
    FROM dbo.Review AS r
    INNER JOIN dbo.Assignment AS a
        ON r.AssignmentID = a.AssignmentID
    INNER JOIN dbo.Proposal AS pr
        ON a.ProposalID = pr.ProposalID
    WHERE pr.FreelancerID = @FreelancerID
      AND r.RevieweeID = @FreelancerID;

    RETURN @AverageRating;
END;
GO

CREATE OR ALTER FUNCTION dbo.fn_ProjectOutstandingAmount (
    @ProjectID INT
)
RETURNS DECIMAL(12,2)
AS
BEGIN
    DECLARE @AssignmentID INT;
    DECLARE @AgreedAmount DECIMAL(12,2);
    DECLARE @TotalPaid DECIMAL(12,2);

    SELECT
        @AssignmentID = AssignmentID,
        @AgreedAmount = AgreedAmount
    FROM dbo.Assignment
    WHERE ProjectID = @ProjectID;

    IF @AssignmentID IS NULL
        RETURN NULL;

    SELECT @TotalPaid = ISNULL(SUM(Amount), 0)
    FROM dbo.Payment
    WHERE AssignmentID = @AssignmentID
      AND PaymentStatus = 'Completed';

    RETURN @AgreedAmount - @TotalPaid;
END;
GO

CREATE OR ALTER VIEW dbo.vw_FreelancerProjectSummary
AS
WITH ProjectTotals AS (
    SELECT
        pr.FreelancerID,
        COUNT(*) AS AssignedProjects,
        SUM(
            CASE
                WHEN p.ProjectStatus = 'Completed'
                     AND a.CompletedAt IS NOT NULL
                THEN 1
                ELSE 0
            END
        ) AS CompletedProjects
    FROM dbo.Assignment AS a
    INNER JOIN dbo.Proposal AS pr
        ON a.ProposalID = pr.ProposalID
    INNER JOIN dbo.Project AS p
        ON a.ProjectID = p.ProjectID
    GROUP BY pr.FreelancerID
)
SELECT
    f.FreelancerID,
    u.FullName,
    f.ProfessionalTitle,
    f.HourlyRate,
    u.IsActive,
    ISNULL(pt.AssignedProjects, 0) AS AssignedProjects,
    ISNULL(pt.CompletedProjects, 0) AS CompletedProjects,
    dbo.fn_FreelancerAverageRating(f.FreelancerID)
        AS AverageRating
FROM dbo.Freelancer AS f
INNER JOIN dbo.UserAccount AS u
    ON f.FreelancerID = u.UserID
LEFT JOIN ProjectTotals AS pt
    ON f.FreelancerID = pt.FreelancerID;
GO

CREATE OR ALTER VIEW dbo.vw_ProjectPaymentSummary
AS
WITH CompletedPayments AS (
    SELECT
        AssignmentID,
        SUM(Amount) AS TotalPaid
    FROM dbo.Payment
    WHERE PaymentStatus = 'Completed'
    GROUP BY AssignmentID
)
SELECT
    p.ProjectID,
    p.Title,
    p.ClientID,
    u.FullName AS ClientName,
    p.ServiceID,
    s.ServiceName,
    p.ProjectStatus,
    p.Budget,
    p.Deadline,
    a.AssignmentID,
    a.AgreedAmount,
    ISNULL(cp.TotalPaid, 0) AS TotalPaid,
    a.AgreedAmount - ISNULL(cp.TotalPaid, 0)
        AS OutstandingAmount
FROM dbo.Project AS p
INNER JOIN dbo.Client AS c
    ON p.ClientID = c.ClientID
INNER JOIN dbo.UserAccount AS u
    ON c.ClientID = u.UserID
INNER JOIN dbo.AIService AS s
    ON p.ServiceID = s.ServiceID
LEFT JOIN dbo.Assignment AS a
    ON p.ProjectID = a.ProjectID
LEFT JOIN CompletedPayments AS cp
    ON a.AssignmentID = cp.AssignmentID;
GO

SELECT
    name AS ObjectName,
    type_desc AS ObjectType
FROM sys.objects
WHERE schema_id = SCHEMA_ID('dbo')
  AND name IN (
      'fn_FreelancerAverageRating',
      'fn_ProjectOutstandingAmount',
      'vw_FreelancerProjectSummary',
      'vw_ProjectPaymentSummary'
  )
ORDER BY name;

SELECT
    CAST(SERVERPROPERTY('IsIntegratedSecurityOnly') AS INT)
        AS WindowsAuthenticationOnly;
        GO

USE AIFreelanceDB;
GO

INSERT INTO dbo.AIService (ServiceName, Description)
SELECT source.ServiceName, source.Description
FROM (
    VALUES
    (
        N'AI Chatbot Development',
        N'Build chatbots for customer support and business enquiries.'
    ),
    (
        N'Document Question Answering',
        N'Build applications that answer questions using supplied documents.'
    ),
    (
        N'Predictive Analytics',
        N'Use historical data to forecast business outcomes.'
    ),
    (
        N'Computer Vision',
        N'Build applications that analyse images and recognise objects.'
    ),
    (
        N'Natural Language Processing',
        N'Analyse, classify and extract information from text.'
    ),
    (
        N'Speech Transcription',
        N'Convert recorded speech into searchable text.'
    ),
    (
        N'Recommendation Systems',
        N'Recommend relevant products, services or content to users.'
    ),
    (
        N'AI Workflow Automation',
        N'Automate business tasks using AI tools and integrations.'
    ),
    (
        N'Data Preparation and Labelling',
        N'Clean, organise and label datasets for AI projects.'
    ),
    (
        N'AI Model Deployment',
        N'Deploy trained models as applications or API services.'
    )
) AS source (ServiceName, Description)
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.AIService AS existing
    WHERE existing.ServiceName = source.ServiceName
);
GO

INSERT INTO dbo.Skill (SkillName, Description)
SELECT source.SkillName, source.Description
FROM (
    VALUES
    (
        N'Python',
        N'Programming for data processing, automation and AI applications.'
    ),
    (
        N'SQL',
        N'Querying and managing relational databases.'
    ),
    (
        N'Machine Learning',
        N'Training and evaluating predictive models.'
    ),
    (
        N'Natural Language Processing',
        N'Processing and analysing human language.'
    ),
    (
        N'Computer Vision',
        N'Processing and analysing images and video.'
    ),
    (
        N'Retrieval-Augmented Generation',
        N'Connecting language models to relevant external information.'
    ),
    (
        N'API Development',
        N'Building interfaces for applications and model services.'
    ),
    (
        N'Data Analysis',
        N'Exploring datasets and communicating useful findings.'
    ),
    (
        N'Model Deployment',
        N'Publishing and maintaining trained models for application use.'
    ),
    (
        N'Data Annotation',
        N'Labelling examples for model training and evaluation.'
    )
) AS source (SkillName, Description)
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.Skill AS existing
    WHERE existing.SkillName = source.SkillName
);
GO

SELECT ServiceID, ServiceName, IsActive
FROM dbo.AIService
ORDER BY ServiceName;

SELECT SkillID, SkillName
FROM dbo.Skill
ORDER BY SkillName;
GO


-- Additional AI Services
INSERT INTO dbo.AIService (ServiceName, Description, IsActive)
SELECT v.ServiceName, v.Description, v.IsActive
FROM (VALUES
    (N'Web Development', N'Website and web application development', 1),
    (N'Graphic Design', N'Logo, banner and graphic design', 1),
    (N'Mobile App Development', N'Android and iOS application development', 1),
    (N'Content Writing', N'Articles and website content writing', 1),
    (N'Digital Marketing', N'Online marketing and SEO services', 1)
) AS v(ServiceName, Description, IsActive)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.AIService AS a
    WHERE a.ServiceName = v.ServiceName
);
GO

-- Additional Skills
INSERT INTO dbo.Skill (SkillName, Description)
SELECT v.SkillName, v.Description
FROM (VALUES
    (N'HTML', N'HTML web development'),
    (N'CSS', N'CSS styling'),
    (N'JavaScript', N'JavaScript programming'),
    (N'React', N'React frontend development'),
    (N'Node.js', N'Backend development'),
    (N'Python', N'Python programming'),
    (N'PHP', N'PHP development'),
    (N'Photoshop', N'Graphic design'),
    (N'Figma', N'UI UX design'),
    (N'SEO', N'Search engine optimization')
) AS v(SkillName, Description)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Skill AS s
    WHERE s.SkillName = v.SkillName
);
GO
