USE [AIFreelanceDB]
GO
SET IDENTITY_INSERT [dbo].[AIService] ON 
GO
INSERT [dbo].[AIService] ([ServiceID], [ServiceName], [Description], [IsActive]) VALUES (1, N'Web Development', N'Website and web application development', 1)
GO
INSERT [dbo].[AIService] ([ServiceID], [ServiceName], [Description], [IsActive]) VALUES (2, N'Graphic Design', N'Logo, banner and graphic design', 1)
GO
INSERT [dbo].[AIService] ([ServiceID], [ServiceName], [Description], [IsActive]) VALUES (3, N'Mobile App Development', N'Android and iOS application development', 1)
GO
INSERT [dbo].[AIService] ([ServiceID], [ServiceName], [Description], [IsActive]) VALUES (4, N'Content Writing', N'Articles and website content writing', 1)
GO
INSERT [dbo].[AIService] ([ServiceID], [ServiceName], [Description], [IsActive]) VALUES (5, N'Digital Marketing', N'Online marketing and SEO services', 1)
GO
SET IDENTITY_INSERT [dbo].[AIService] OFF
GO
SET IDENTITY_INSERT [dbo].[Skill] ON 
GO
INSERT [dbo].[Skill] ([SkillID], [SkillName], [Description]) VALUES (1, N'HTML', N'HTML web development')
GO
INSERT [dbo].[Skill] ([SkillID], [SkillName], [Description]) VALUES (2, N'CSS', N'CSS styling')
GO
INSERT [dbo].[Skill] ([SkillID], [SkillName], [Description]) VALUES (3, N'JavaScript', N'JavaScript programming')
GO
INSERT [dbo].[Skill] ([SkillID], [SkillName], [Description]) VALUES (4, N'React', N'React frontend development')
GO
INSERT [dbo].[Skill] ([SkillID], [SkillName], [Description]) VALUES (5, N'Node.js', N'Backend development')
GO
INSERT [dbo].[Skill] ([SkillID], [SkillName], [Description]) VALUES (6, N'Python', N'Python programming')
GO
INSERT [dbo].[Skill] ([SkillID], [SkillName], [Description]) VALUES (7, N'PHP', N'PHP development')
GO
INSERT [dbo].[Skill] ([SkillID], [SkillName], [Description]) VALUES (8, N'Photoshop', N'Graphic design')
GO
INSERT [dbo].[Skill] ([SkillID], [SkillName], [Description]) VALUES (9, N'Figma', N'UI UX design')
GO
INSERT [dbo].[Skill] ([SkillID], [SkillName], [Description]) VALUES (10, N'SEO', N'Search engine optimization')
GO
SET IDENTITY_INSERT [dbo].[Skill] OFF
GO
