' Verificar Conexão SAP
' Script para verificar se o SAP GUI está aberto e conectado
' Uso: cscript //nologo verificar_conexao.vbs

On Error Resume Next

' Tentar conectar ao SAP GUI
Set SapGuiAuto = GetObject("SAPGUI")
If Err.Number <> 0 Then
    WScript.Echo "SAP GUI não está aberto"
    WScript.Quit 1
End If

Set application = SapGuiAuto.GetScriptingEngine
If application Is Nothing Then
    WScript.Echo "Scripting Engine não disponível"
    WScript.Quit 1
End If

If application.Children.Count = 0 Then
    WScript.Echo "Nenhuma conexão SAP ativa"
    WScript.Quit 1
End If

Set connection = application.Children(0)
If connection.Children.Count = 0 Then
    WScript.Echo "Nenhuma sessão SAP ativa"
    WScript.Quit 1
End If

Set session = connection.Children(0)

' Obter informações da sessão
systemName = session.Info.SystemName
client = session.Info.Client
user = session.Info.User
language = session.Info.Language

WScript.Echo "Conectado ao SAP!"
WScript.Echo "Sistema: " & systemName
WScript.Echo "Mandante: " & client
WScript.Echo "Usuário: " & user
WScript.Echo "Idioma: " & language
